import { useState, useEffect } from 'react'
import api from '../api'

const STATUS_COLORS = {
  present:    'bg-green-100 text-green-700',
  late:       'bg-yellow-100 text-yellow-700',
  half_day:   'bg-orange-100 text-orange-700',
  absent:     'bg-red-100 text-red-700',
  not_clocked_in: 'bg-slate-100 text-slate-500',
}
const STATUS_LABELS = {
  present:    '✅ Present',
  late:       '⏰ Late',
  half_day:   '🌗 Half Day',
  absent:     '❌ Absent',
  not_clocked_in: '—',
}

export default function Attendance() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isAdmin = user.role === 'admin'

  const [tab, setTab] = useState('my')
  const [now, setNow] = useState(new Date())
  const [today, setToday] = useState(null)     // today's record
  const [loadingToday, setLoadingToday] = useState(true)
  const [clocking, setClocking] = useState(false)
  const [message, setMessage] = useState(null)  // { type: 'success'|'error', text }
  const [locStatus, setLocStatus] = useState('idle') // idle | locating | ok | denied | unavailable
  const [locCoords, setLocCoords] = useState(null)
  const [history, setHistory] = useState([])
  const [histMonth, setHistMonth] = useState(new Date().getMonth() + 1)
  const [histYear, setHistYear] = useState(new Date().getFullYear())

  // Admin report
  const [report, setReport] = useState([])
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1)
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [reportUser, setReportUser] = useState('')
  const [users, setUsers] = useState([])
  const [loadingReport, setLoadingReport] = useState(false)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Get FRESH location at the moment of action — never cached
  const getFreshLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) {
      setLocStatus('unavailable')
      resolve(null)
      return
    }
    setLocStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocCoords(coords)
        setLocStatus('ok')
        resolve(coords)
      },
      (err) => {
        // err.code: 1=denied, 2=unavailable, 3=timeout
        setLocStatus(err.code === 1 ? 'denied' : 'unavailable')
        setLocCoords(null)
        resolve(null)  // allow clock-in without location
      },
      {
        enableHighAccuracy: true,   // use GPS chip, not WiFi/IP
        maximumAge: 0,              // NEVER use cached position — always fresh
        timeout: 15000,            // wait up to 15s for GPS fix
      }
    )
  })

  // Load today's status
  const loadToday = async () => {
    setLoadingToday(true)
    try {
      const r = await api.get('/attendance/today')
      setToday(r.data)
    } catch { setToday(null) }
    setLoadingToday(false)
  }

  // Load my history
  const loadHistory = async () => {
    try {
      const r = await api.get('/attendance/my-history', { params: { month: histMonth, year: histYear } })
      setHistory(r.data)
    } catch {}
  }

  useEffect(() => { loadToday() }, [])
  useEffect(() => { loadHistory() }, [histMonth, histYear])

  // Load admin data
  useEffect(() => {
    if (isAdmin) {
      api.get('/users').then(r => setUsers(r.data)).catch(() => {})
    }
  }, [isAdmin])

  const loadReport = async () => {
    setLoadingReport(true)
    try {
      const r = await api.get('/attendance/report', {
        params: { month: reportMonth, year: reportYear, user_id: reportUser || undefined }
      })
      setReport(r.data)
    } catch {}
    setLoadingReport(false)
  }
  useEffect(() => { if (tab === 'report' && isAdmin) loadReport() }, [tab, reportMonth, reportYear, reportUser])

  const handleClockIn = async () => {
    setClocking(true)
    setMessage(null)
    // Get fresh GPS coordinates RIGHT NOW — not the page-load position
    const coords = await getFreshLocation()
    try {
      const r = await api.post('/attendance/clock-in', {
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        location_note: coords ? undefined : 'Location unavailable at clock-in',
      })
      setMessage({ type: 'success', text: r.data.message })
      loadToday()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Clock in failed' })
    }
    setClocking(false)
  }

  const handleClockOut = async () => {
    setClocking(true)
    setMessage(null)
    // Get fresh GPS coordinates RIGHT NOW — not the page-load position
    const coords = await getFreshLocation()
    try {
      const r = await api.post('/attendance/clock-out', {
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      })
      setMessage({ type: 'success', text: r.data.message })
      loadToday()
      loadHistory()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Clock out failed' })
    }
    setClocking(false)
  }

  const fmtTime = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  const fmtDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-PK', { weekday: 'short', day: '2-digit', month: 'short' })
  }

  const notClockedIn = !today || today.status === 'not_clocked_in' || !today.clock_in
  const clockedIn = today?.clock_in && !today?.clock_out
  const clockedOut = today?.clock_in && today?.clock_out

  // Monthly summary
  const summary = {
    present: history.filter(r => r.status === 'present').length,
    late: history.filter(r => r.status === 'late').length,
    half_day: history.filter(r => r.status === 'half_day').length,
    total_hours: history.reduce((s, r) => s + (r.hours_worked || 0), 0).toFixed(1),
  }

  return (
    <div className="animate-fadeIn space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Attendance</h2>
          <p className="text-sm text-slate-500 mt-0.5">Staff clock-in / clock-out with location tracking</p>
        </div>
        <button onClick={() => window.print()} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 print:hidden">
          🖨️ Print
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 print:hidden">
        {[
          { key: 'my', label: '🙋 My Attendance' },
          { key: 'history', label: '📅 My History' },
          ...(isAdmin ? [{ key: 'report', label: '📊 Staff Report' }] : []),
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MY ATTENDANCE TAB ─────────────────────────────────────────── */}
      {tab === 'my' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Clock card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center text-center space-y-4">
            {/* Live clock */}
            <div className="text-5xl font-mono font-bold text-slate-800 tabular-nums">
              {now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <div className="text-sm text-slate-500">
              {now.toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>

            {/* Location indicator — updates live when clock-in is pressed */}
            <div className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
              locStatus === 'ok'          ? 'bg-green-50 text-green-700' :
              locStatus === 'locating'    ? 'bg-blue-50 text-blue-700 animate-pulse' :
              locStatus === 'denied'      ? 'bg-red-50 text-red-700' :
              locStatus === 'unavailable' ? 'bg-orange-50 text-orange-700' :
                                           'bg-slate-100 text-slate-500'
            }`}>
              {locStatus === 'ok'          && `📍 Location recorded (${locCoords?.lat?.toFixed(4)}, ${locCoords?.lng?.toFixed(4)})`}
              {locStatus === 'locating'    && '📡 Getting your current location...'}
              {locStatus === 'denied'      && '⚠️ Location access denied — attendance recorded without location'}
              {locStatus === 'unavailable' && '⚠️ GPS unavailable — attendance recorded without location'}
              {locStatus === 'idle'        && '📍 Location will be captured when you clock in/out'}
            </div>

            {/* Status */}
            {loadingToday ? (
              <div className="text-slate-400 text-sm">Loading status...</div>
            ) : (
              <div className={`px-4 py-2 rounded-full text-sm font-semibold ${today?.clock_in ? STATUS_COLORS[today.status] : 'bg-slate-100 text-slate-500'}`}>
                {today?.clock_in ? STATUS_LABELS[today.status] : 'Not clocked in today'}
              </div>
            )}

            {/* Message */}
            {message && (
              <div className={`w-full px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {message.text}
              </div>
            )}

            {/* Action button */}
            {!loadingToday && (
              <>
                {notClockedIn && (
                  <button onClick={handleClockIn} disabled={clocking}
                    className="w-full py-4 bg-green-600 text-white rounded-2xl text-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-all shadow-md shadow-green-200 active:scale-95">
                    {locStatus === 'locating' ? '📡 Getting Location...' : clocking ? 'Saving...' : '👆 Clock In'}
                  </button>
                )}
                {clockedIn && (
                  <button onClick={handleClockOut} disabled={clocking}
                    className="w-full py-4 bg-red-600 text-white rounded-2xl text-lg font-bold hover:bg-red-700 disabled:opacity-50 transition-all shadow-md shadow-red-200 active:scale-95">
                    {locStatus === 'locating' ? '📡 Getting Location...' : clocking ? 'Saving...' : '🚪 Clock Out'}
                  </button>
                )}
                {clockedOut && (
                  <div className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl text-center font-medium">
                    ✅ Attendance complete for today
                  </div>
                )}
              </>
            )}
          </div>

          {/* Today's details card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800">Today's Record</h3>
            <div className="space-y-3">
              {[
                { label: 'Staff Name', value: user.full_name || user.username || '—' },
                { label: 'Clock In', value: today?.clock_in ? fmtTime(today.clock_in) : '—' },
                { label: 'Clock Out', value: today?.clock_out ? fmtTime(today.clock_out) : '—' },
                { label: 'Status', value: today?.clock_in ? STATUS_LABELS[today?.status] || today?.status : '—' },
                {
                  label: 'Hours Worked',
                  value: today?.clock_in && today?.clock_out
                    ? `${((new Date(today.clock_out) - new Date(today.clock_in)) / 3600000).toFixed(1)} hrs`
                    : today?.clock_in ? 'In progress...' : '—'
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-sm font-medium text-slate-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">📋 Policy</p>
              <p>• On time: before 9:30 AM</p>
              <p>• Late: after 9:30 AM</p>
              <p>• Half day: less than 4 hours worked</p>
              <p>• One clock-in per day, no changes allowed</p>
            </div>
          </div>
        </div>
      )}

      {/* ── MY HISTORY TAB ───────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Month/Year filter */}
          <div className="flex gap-3 items-center">
            <select value={histMonth} onChange={e => setHistMonth(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
            <select value={histYear} onChange={e => setHistYear(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Monthly summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Present', value: summary.present, color: 'bg-green-50 border-green-200 text-green-700' },
              { label: 'Late', value: summary.late, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
              { label: 'Half Days', value: summary.half_day, color: 'bg-orange-50 border-orange-200 text-orange-700' },
              { label: 'Total Hours', value: `${summary.total_hours}h`, color: 'bg-blue-50 border-blue-200 text-blue-700' },
            ].map(s => (
              <div key={s.label} className={`border rounded-xl p-3 ${s.color}`}>
                <div className="text-xs mb-1">{s.label}</div>
                <div className="text-2xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>

          {/* History table */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="text-4xl mb-3">📅</div>
                <p>No attendance records for this period</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Clock In</th>
                    <th className="text-left px-4 py-3">Clock Out</th>
                    <th className="text-left px-4 py-3">Hours</th>
                    <th className="text-left px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{fmtDate(r.date + 'T00:00:00')}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtTime(r.clock_in)}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtTime(r.clock_out)}</td>
                      <td className="px-4 py-3 text-slate-600">{r.hours_worked ? `${r.hours_worked}h` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                          {STATUS_LABELS[r.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── ADMIN REPORT TAB ─────────────────────────────────────────── */}
      {tab === 'report' && isAdmin && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <select value={reportMonth} onChange={e => setReportMonth(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
            <select value={reportYear} onChange={e => setReportYear(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={reportUser} onChange={e => setReportUser(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Staff</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
            </select>
            <button onClick={loadReport} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              🔍 Load Report
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            {loadingReport ? (
              <div className="p-12 text-center text-slate-400">Loading report...</div>
            ) : report.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="text-4xl mb-3">📊</div>
                <p>No records for this period</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Staff</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Clock In</th>
                    <th className="text-left px-4 py-3">Clock Out</th>
                    <th className="text-left px-4 py-3">Hours</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {report.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.user_name}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(r.date + 'T00:00:00')}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtTime(r.clock_in)}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtTime(r.clock_out)}</td>
                      <td className="px-4 py-3 text-slate-600">{r.hours_worked ? `${r.hours_worked}h` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                          {STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{r.ip_address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
