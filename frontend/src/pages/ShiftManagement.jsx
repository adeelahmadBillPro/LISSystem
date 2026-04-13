import { useState, useEffect, useContext } from 'react'
import api from '../api'
import { ThemeContext } from '../App'
import ModalPortal from '../components/ModalPortal'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

const SHIFT_CONFIG = {
  morning: { label: 'Morning',   color: 'bg-blue-100 text-blue-700',     start: '08:00', end: '14:00', icon: '🌅' },
  evening: { label: 'Evening',   color: 'bg-orange-100 text-orange-700', start: '14:00', end: '20:00', icon: '🌆' },
  night:   { label: 'Night',     color: 'bg-purple-100 text-purple-700', start: '20:00', end: '08:00', icon: '🌙' },
  custom:  { label: 'Custom',    color: 'bg-slate-100 text-slate-600',   start: '',      end: '',      icon: '⚙️' },
}

const STATUS_CONFIG = {
  scheduled:  { label: 'Scheduled',  color: 'bg-blue-100 text-blue-700' },
  active:     { label: 'Active',     color: 'bg-green-100 text-green-700' },
  completed:  { label: 'Completed',  color: 'bg-slate-100 text-slate-500' },
  absent:     { label: 'Absent',     color: 'bg-red-100 text-red-700' },
  leave:      { label: 'Leave',      color: 'bg-yellow-100 text-yellow-700' },
}

const EMPTY_FORM = {
  user_id: '', shift_date: '', shift_type: 'morning',
  start_time: '08:00', end_time: '14:00', notes: '',
}

export default function ShiftManagement() {
  const { darkMode } = useContext(ThemeContext)
  const now = new Date()

  const [view, setView]             = useState('schedule')   // schedule | summary
  const [selDate, setSelDate]       = useState(now.toISOString().slice(0, 10))
  const [selMonth, setSelMonth]     = useState(now.getMonth() + 1)
  const [selYear, setSelYear]       = useState(now.getFullYear())
  const [shifts, setShifts]         = useState([])
  const [summary, setSummary]       = useState([])
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [sumLoading, setSumLoading] = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [editId, setEditId]         = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [deleting, setDeleting]     = useState(null)

  const card  = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
  const input = `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`
  const th    = `text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-500'}`

  useEffect(() => { api.get('/users').then(r => setUsers(r.data)).catch(() => {}) }, [])
  useEffect(() => { if (view === 'schedule') fetchShifts() }, [view, selDate])
  useEffect(() => { if (view === 'summary')  fetchSummary() }, [view, selMonth, selYear])

  const fetchShifts = async () => {
    setLoading(true)
    try {
      const r = await api.get('/shifts', { params: { shift_date: selDate } })
      setShifts(r.data)
    } catch { setShifts([]) }
    setLoading(false)
  }

  const fetchSummary = async () => {
    setSumLoading(true)
    try {
      const r = await api.get('/shifts/summary', { params: { month: selMonth, year: selYear } })
      setSummary(r.data)
    } catch { setSummary([]) }
    setSumLoading(false)
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ ...EMPTY_FORM, shift_date: selDate })
    setError('')
    setShowModal(true)
  }

  const openEdit = (shift) => {
    setEditId(shift.id)
    setForm({
      user_id:    shift.user_id    || '',
      shift_date: shift.shift_date || selDate,
      shift_type: shift.shift_type || 'morning',
      start_time: shift.start_time || SHIFT_CONFIG[shift.shift_type]?.start || '08:00',
      end_time:   shift.end_time   || SHIFT_CONFIG[shift.shift_type]?.end   || '14:00',
      notes:      shift.notes      || '',
    })
    setError('')
    setShowModal(true)
  }

  const handleShiftTypeChange = (type) => {
    const cfg = SHIFT_CONFIG[type]
    setForm(f => ({
      ...f,
      shift_type: type,
      start_time: cfg.start || f.start_time,
      end_time:   cfg.end   || f.end_time,
    }))
  }

  const handleSubmit = async () => {
    if (!form.user_id)    return setError('Please select a staff member')
    if (!form.shift_date) return setError('Date is required')
    setSubmitting(true); setError('')
    try {
      if (editId) await api.put(`/shifts/${editId}`, form)
      else        await api.post('/shifts', form)
      setShowModal(false)
      fetchShifts()
    } catch (e) { setError(e.response?.data?.detail || 'Failed to save shift') }
    setSubmitting(false)
  }

  const deleteShift = async (id) => {
    if (!window.confirm('Delete this shift?')) return
    setDeleting(id)
    try { await api.delete(`/shifts/${id}`); fetchShifts() } catch {}
    setDeleting(null)
  }

  const getUserName = (id) => {
    const u = users.find(u => u.id === id || String(u.id) === String(id))
    return u ? (u.full_name || u.username || u.name) : `User #${id}`
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Shift Management</h2>
          <p className="text-sm text-slate-500">Schedule and track staff shifts</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {/* Print button */}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm hover:bg-slate-800 flex items-center gap-2"
          >
            🖨️ Print
          </button>

          {/* View toggle */}
          <div className={`flex rounded-xl border overflow-hidden text-sm ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            {['schedule', 'summary'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 capitalize font-medium transition-colors ${
                  view === v
                    ? 'bg-blue-600 text-white'
                    : darkMode
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {v === 'schedule' ? '📅 Schedule' : '📊 Summary'}
              </button>
            ))}
          </div>

          {view === 'schedule' && (
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 flex items-center gap-2"
            >
              + Add Shift
            </button>
          )}
        </div>
      </div>

      {/* Date / Month Controls */}
      <div className={`rounded-2xl border p-4 mb-6 flex flex-wrap items-end gap-4 print:hidden ${card}`}>
        {view === 'schedule' ? (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
            <input
              type="date"
              value={selDate}
              onChange={e => setSelDate(e.target.value)}
              className={`${input} w-auto`}
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
              <select
                value={selMonth}
                onChange={e => setSelMonth(Number(e.target.value))}
                className={`${input} w-auto`}
              >
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
              <select
                value={selYear}
                onChange={e => setSelYear(Number(e.target.value))}
                className={`${input} w-auto`}
              >
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* ── SCHEDULE VIEW ─────────────────────────────────────────────────── */}
      {view === 'schedule' && (
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
          <div className={`px-5 py-3 border-b font-semibold text-sm ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
            Shifts for {new Date(selDate + 'T00:00').toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading shifts...</div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No shifts scheduled for this date.
              <br />
              <button
                onClick={openAdd}
                className="mt-3 px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 print:hidden"
              >
                + Add First Shift
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={th}>Staff</th>
                    <th className={th}>Shift</th>
                    <th className={th}>Time</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={th}>Notes</th>
                    {/* Action column hidden in print */}
                    <th className={`${th} text-center print:hidden`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                  {shifts.map(s => {
                    const sc = SHIFT_CONFIG[s.shift_type] || SHIFT_CONFIG.custom
                    const st = STATUS_CONFIG[s.status]    || STATUS_CONFIG.scheduled
                    return (
                      <tr key={s.id} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{s.user_name || getUserName(s.user_id)}</div>
                          <div className="text-xs text-slate-400">{s.user_role || ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                            {sc.icon} {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-600 dark:text-slate-300">
                          {s.start_time} – {s.end_time}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate" title={s.notes}>
                          {s.notes || '—'}
                        </td>
                        {/* Action buttons hidden in print */}
                        <td className="px-4 py-3 text-center print:hidden">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEdit(s)}
                              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteShift(s.id)}
                              disabled={deleting === s.id}
                              className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                            >
                              {deleting === s.id ? '...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY VIEW ──────────────────────────────────────────────────── */}
      {view === 'summary' && (
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
          <div className={`px-5 py-3 border-b font-semibold text-sm ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
            Monthly Attendance — {MONTHS[selMonth - 1]} {selYear}
          </div>
          {sumLoading ? (
            <div className="text-center py-12 text-slate-400">Loading summary...</div>
          ) : summary.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No attendance data for this month</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={th}>Staff</th>
                    <th className={th}>Role</th>
                    <th className={`${th} text-center`}>Scheduled</th>
                    <th className={`${th} text-center`}>Completed</th>
                    <th className={`${th} text-center`}>Absent</th>
                    <th className={`${th} text-center`}>Leave</th>
                    <th className={`${th} text-center`}>Attendance %</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                  {summary.map((row, i) => {
                    const pct = row.scheduled > 0
                      ? Math.round((row.completed / row.scheduled) * 100)
                      : 0
                    return (
                      <tr key={i} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-3 font-medium">{row.user_name || row.name}</td>
                        <td className="px-4 py-3 text-slate-500 capitalize">{row.role || '—'}</td>
                        <td className="px-4 py-3 text-center">{row.scheduled ?? 0}</td>
                        <td className="px-4 py-3 text-center text-green-600 font-medium">{row.completed ?? 0}</td>
                        <td className="px-4 py-3 text-center text-red-600 font-medium">{row.absent ?? 0}</td>
                        <td className="px-4 py-3 text-center text-yellow-600 font-medium">{row.leave ?? 0}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Shift Modal — hidden in print */}
      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className={`rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-slate-800 text-white' : 'bg-white'}`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-lg">{editId ? 'Edit Shift' : 'Add Shift'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Staff select */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Staff Member *</label>
                <select
                  value={form.user_id}
                  onChange={e => setForm({ ...form, user_id: e.target.value })}
                  className={input}
                >
                  <option value="">— Select Staff —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.username || u.name} {u.role ? `(${u.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date *</label>
                <input
                  type="date"
                  value={form.shift_date}
                  onChange={e => setForm({ ...form, shift_date: e.target.value })}
                  className={input}
                />
              </div>

              {/* Shift type */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Shift Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(SHIFT_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => handleShiftTypeChange(key)}
                      type="button"
                      className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors text-left ${
                        form.shift_type === key
                          ? `${cfg.color} border-current`
                          : darkMode
                            ? 'border-slate-600 text-slate-300 hover:border-slate-400'
                            : 'border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      <span className="mr-1">{cfg.icon}</span>
                      <span>{cfg.label}</span>
                      {cfg.start && (
                        <div className="text-xs opacity-70 font-normal mt-0.5">{cfg.start} – {cfg.end}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                    className={input}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End Time</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm({ ...form, end_time: e.target.value })}
                    className={input}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className={input}
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>

              {error && <div className="text-sm text-red-500">{error}</div>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editId ? 'Update Shift' : 'Add Shift'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
