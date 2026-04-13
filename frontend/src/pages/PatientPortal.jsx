import { useState, useEffect } from 'react'
import axios from 'axios'

const portalApi = axios.create({ baseURL: '/api' })

// Attach portal token to every request
portalApi.interceptors.request.use((config) => {
  const t = localStorage.getItem('portal_token')
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

const FLAG_STYLE = {
  HH: 'text-red-700 font-extrabold',
  H:  'text-red-600 font-bold',
  L:  'text-blue-600 font-bold',
  LL: 'text-blue-700 font-extrabold',
}
const FLAG_LABEL = { HH: 'CRIT HIGH', H: 'HIGH', L: 'LOW', LL: 'CRIT LOW' }

export default function PatientPortal() {
  // ── Auth state ─────────────────────────────────────────────────────────────
  const [loggedIn, setLoggedIn]       = useState(false)
  const [token, setToken]             = useState('')
  const [patient, setPatient]         = useState(null)   // { id, name, mrn, ... }
  const [loginForm, setLoginForm]     = useState({ mrn: '', phone: '' })
  const [loginError, setLoginError]   = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // ── App tabs ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('reports')  // reports | appointments

  // ── Reports state ──────────────────────────────────────────────────────────
  const [reports, setReports]         = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [expandedReport, setExpandedReport] = useState(null)  // sample_id
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')

  // ── Appointments state ─────────────────────────────────────────────────────
  const [appointments, setAppointments] = useState([])
  const [apptLoading, setApptLoading]   = useState(false)
  const [doctors, setDoctors]           = useState([])
  const [apptForm, setApptForm]         = useState({
    doctor_id: '', date: '', time: '09:00', reason: ''
  })
  const [apptSaving, setApptSaving]     = useState(false)
  const [apptError, setApptError]       = useState('')
  const [apptSuccess, setApptSuccess]   = useState('')

  // ── Restore session from localStorage ─────────────────────────────────────
  useEffect(() => {
    const savedToken   = localStorage.getItem('portal_token')
    const savedPatient = localStorage.getItem('portal_patient')
    if (savedToken && savedPatient) {
      try {
        const p = JSON.parse(savedPatient)
        setToken(savedToken)
        setPatient(p)
        setLoggedIn(true)
      } catch { /* corrupted storage — ignore */ }
    }
  }, [])

  // ── Fetch reports after login ──────────────────────────────────────────────
  useEffect(() => {
    if (loggedIn) fetchReports()
  }, [loggedIn])

  // ── Fetch appointments when tab opens ─────────────────────────────────────
  useEffect(() => {
    if (loggedIn && activeTab === 'appointments') {
      fetchAppointments()
      fetchDoctors()
    }
  }, [activeTab, loggedIn])

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const res = await portalApi.post('/portal/login', loginForm)
      const { access_token, patient_name, patient_id, mrn } = res.data
      const p = { id: patient_id, name: patient_name, mrn: mrn || loginForm.mrn }
      localStorage.setItem('portal_token', access_token)
      localStorage.setItem('portal_patient', JSON.stringify(p))
      setToken(access_token)
      setPatient(p)
      setLoggedIn(true)
    } catch (err) {
      setLoginError(err.response?.data?.detail || 'Login failed. Check your MRN and phone number.')
    } finally {
      setLoginLoading(false)
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('portal_token')
    localStorage.removeItem('portal_patient')
    setLoggedIn(false)
    setToken('')
    setPatient(null)
    setReports([])
    setAppointments([])
    setExpandedReport(null)
    setActiveTab('reports')
    setLoginForm({ mrn: '', phone: '' })
  }

  // ── Fetch reports ──────────────────────────────────────────────────────────
  const fetchReports = async () => {
    setReportsLoading(true)
    try {
      const r = await portalApi.get('/portal/reports')
      setReports(r.data)
    } catch {}
    setReportsLoading(false)
  }

  // ── Download PDF ───────────────────────────────────────────────────────────
  const downloadPDF = async (sampleId) => {
    try {
      const res = await portalApi.get(`/report/${sampleId}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.download = `report_${sampleId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      // Fallback: open in new tab with auth header via URL token approach
      window.open(`/api/report/${sampleId}/pdf?token=${token}`, '_blank')
    }
  }

  // ── Fetch appointments ─────────────────────────────────────────────────────
  const fetchAppointments = async () => {
    if (!patient?.id) return
    setApptLoading(true)
    try {
      const r = await portalApi.get('/appointments', { params: { patient_id: patient.id } })
      setAppointments(r.data)
    } catch {}
    setApptLoading(false)
  }

  // ── Fetch doctors ──────────────────────────────────────────────────────────
  const fetchDoctors = async () => {
    try {
      const r = await portalApi.get('/doctors')
      setDoctors(r.data)
    } catch {}
  }

  // ── Book appointment ───────────────────────────────────────────────────────
  const bookAppointment = async (e) => {
    e.preventDefault()
    setApptError('')
    setApptSuccess('')
    if (!apptForm.doctor_id || !apptForm.date) {
      setApptError('Please select a doctor and date.')
      return
    }
    setApptSaving(true)
    try {
      await portalApi.post('/appointments', {
        ...apptForm,
        patient_id: patient.id,
        doctor_id: parseInt(apptForm.doctor_id),
      })
      setApptSuccess('Appointment booked successfully!')
      setApptForm({ doctor_id: '', date: '', time: '09:00', reason: '' })
      fetchAppointments()
    } catch (err) {
      setApptError(err.response?.data?.detail || 'Failed to book appointment.')
    } finally {
      setApptSaving(false)
    }
  }

  // ── Filtered reports ───────────────────────────────────────────────────────
  const filteredReports = reports.filter(r => {
    if (!r.date) return true
    const d = new Date(r.date)
    if (dateFrom && d < new Date(dateFrom)) return false
    if (dateTo   && d > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  // ── Flag style helper ──────────────────────────────────────────────────────
  const getFlagStyle = (flag) => FLAG_STYLE[flag] || 'text-green-600'
  const getFlagLabel = (flag) => FLAG_LABEL[flag] || 'Normal'

  // ══════════════════════════════════════════════════════════════════════════
  //  LOGIN VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md animate-scaleIn">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🏥</div>
            <h1 className="text-2xl font-bold text-slate-800">Patient Portal</h1>
            <p className="text-sm text-slate-500 mt-1">View your lab reports & book appointments</p>
          </div>
          {loginError && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm animate-slideDown">
              {loginError}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MRN (Medical Record Number)</label>
              <input
                value={loginForm.mrn}
                onChange={e => setLoginForm({ ...loginForm, mrn: e.target.value })}
                required
                placeholder="e.g., PAT001"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                value={loginForm.phone}
                onChange={e => setLoginForm({ ...loginForm, phone: e.target.value })}
                required
                placeholder="e.g., 0300-1234567"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 transition-all"
            >
              {loginLoading ? 'Checking...' : 'View My Reports'}
            </button>
          </form>
          <p className="text-xs text-center text-slate-400 mt-4">Your MRN is on your lab receipt</p>
          <div className="text-center mt-5 pt-4 border-t border-slate-100">
            <a href="/landing" className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors">
              ← Back to Home
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PORTAL VIEW (logged in)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏥</span>
            <div>
              <div className="font-bold text-slate-800 text-sm leading-tight">
                Welcome, {patient?.name}
              </div>
              <div className="text-xs text-slate-400">MRN: {patient?.mrn}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-red-50 hover:text-red-600 transition-colors border border-slate-200"
          >
            Logout
          </button>
        </div>

        {/* Tab bar */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-2">
          {[
            { id: 'reports',      label: '📋 My Reports' },
            { id: 'appointments', label: '📅 Book Appointment' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 animate-fadeIn">

        {/* ══════════════════════════════════════════════════════════
            TAB: REPORTS
           ══════════════════════════════════════════════════════════ */}
        {activeTab === 'reports' && (
          <div>
            {/* Date filter */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo('') }}
                  className="px-3 py-2 text-xs text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Clear Filter
                </button>
              )}
              <div className="ml-auto text-sm text-slate-500">
                {filteredReports.length} of {reports.length} report(s)
              </div>
              <button onClick={fetchReports} className="text-xs text-blue-600 hover:underline">
                {reportsLoading ? '⏳' : '↻ Refresh'}
              </button>
            </div>

            {/* Report cards */}
            {reportsLoading && (
              <div className="text-center py-12 text-slate-400">Loading reports...</div>
            )}

            {!reportsLoading && filteredReports.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <div className="text-4xl mb-2">📋</div>
                {reports.length === 0
                  ? 'No reports found for your account.'
                  : 'No reports match the selected date range.'}
              </div>
            )}

            <div className="space-y-3">
              {filteredReports.map((r, i) => (
                <div
                  key={r.sample_id || i}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
                >
                  {/* Report header row */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedReport(expandedReport === (r.sample_id || i) ? null : (r.sample_id || i))}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">{r.test_panel || 'Lab Report'}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Sample: <span className="font-medium text-slate-600">{r.sample_id}</span>
                        {r.date && (
                          <span> | {new Date(r.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        )}
                        {r.results?.length > 0 && (
                          <span> | {r.results.length} test(s)</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      {/* Abnormal flag badge */}
                      {r.results?.some(res => res.flag && res.flag !== 'N') && (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded-full border border-red-100">
                          Abnormal
                        </span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); downloadPDF(r.sample_id) }}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                      >
                        Download PDF
                      </button>
                      <span className="text-slate-400 text-sm">
                        {expandedReport === (r.sample_id || i) ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded results table */}
                  {expandedReport === (r.sample_id || i) && (
                    <div className="border-t border-slate-100 animate-slideDown">
                      {r.results && r.results.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Test Name</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Result</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reference Range</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {r.results.map((res, j) => (
                                <tr key={j} className={res.flag && res.flag !== 'N' ? 'bg-red-50/40' : ''}>
                                  <td className="px-5 py-2.5 font-medium text-slate-700">{res.test_name}</td>
                                  <td className={`px-4 py-2.5 ${getFlagStyle(res.flag)}`}>
                                    {res.value}
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-400">{res.unit || '—'}</td>
                                  <td className="px-4 py-2.5 text-slate-400">
                                    {res.ref_low != null && res.ref_high != null
                                      ? `${res.ref_low} – ${res.ref_high}`
                                      : res.reference_range || '—'}
                                  </td>
                                  <td className={`px-4 py-2.5 ${getFlagStyle(res.flag)}`}>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      (res.flag === 'H' || res.flag === 'HH')
                                        ? 'bg-red-100 text-red-700'
                                        : (res.flag === 'L' || res.flag === 'LL')
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                      {getFlagLabel(res.flag)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="px-5 py-6 text-center text-sm text-slate-400">
                          No detailed results available for this report.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: APPOINTMENTS
           ══════════════════════════════════════════════════════════ */}
        {activeTab === 'appointments' && (
          <div className="space-y-5">
            {/* Booking form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-bold text-slate-800 text-lg mb-4">Book a New Appointment</h2>

              {apptError && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
                  {apptError}
                </div>
              )}
              {apptSuccess && (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm font-medium">
                  {apptSuccess}
                </div>
              )}

              <form onSubmit={bookAppointment} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Doctor *</label>
                  <select
                    value={apptForm.doctor_id}
                    onChange={e => setApptForm({ ...apptForm, doctor_id: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Choose a doctor...</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.full_name || d.name}{d.specialization ? ` — ${d.specialization}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={apptForm.date}
                    onChange={e => setApptForm({ ...apptForm, date: e.target.value })}
                    min={new Date().toISOString().slice(0, 10)}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Time</label>
                  <input
                    type="time"
                    value={apptForm.time}
                    onChange={e => setApptForm({ ...apptForm, time: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Chief Complaint</label>
                  <textarea
                    value={apptForm.reason}
                    onChange={e => setApptForm({ ...apptForm, reason: e.target.value })}
                    rows={3}
                    placeholder="Describe your symptoms or reason for visit..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={apptSaving}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 transition-all"
                  >
                    {apptSaving ? 'Booking...' : 'Book Appointment'}
                  </button>
                </div>
              </form>
            </div>

            {/* Existing appointments */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-slate-800 text-lg">My Appointments</h2>
                <button
                  onClick={fetchAppointments}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {apptLoading ? '⏳' : '↻ Refresh'}
                </button>
              </div>

              {apptLoading && (
                <div className="text-center py-8 text-slate-400">Loading...</div>
              )}

              {!apptLoading && appointments.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <div className="text-3xl mb-2">📅</div>
                  No appointments booked yet.
                </div>
              )}

              <div className="space-y-3">
                {appointments.map((a, i) => (
                  <div
                    key={a.id || i}
                    className="flex items-start justify-between p-4 rounded-xl border border-slate-100 bg-slate-50"
                  >
                    <div>
                      <div className="font-semibold text-slate-700 text-sm">
                        {a.doctor_name || `Doctor #${a.doctor_id}`}
                      </div>
                      {a.doctor_specialization && (
                        <div className="text-xs text-slate-400">{a.doctor_specialization}</div>
                      )}
                      <div className="text-xs text-slate-500 mt-1">
                        {a.date && new Date(a.date).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {a.time && ` at ${a.time}`}
                      </div>
                      {a.reason && (
                        <div className="text-xs text-slate-400 mt-0.5 italic">{a.reason}</div>
                      )}
                    </div>
                    <span className={`ml-4 flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      a.status === 'confirmed'  ? 'bg-green-100 text-green-700' :
                      a.status === 'cancelled'  ? 'bg-red-100 text-red-500' :
                      a.status === 'completed'  ? 'bg-blue-100 text-blue-700' :
                                                  'bg-yellow-100 text-yellow-700'
                    }`}>
                      {a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
