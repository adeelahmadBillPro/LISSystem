import { useState, useEffect } from 'react'
import axios from 'axios'

const portalApi = axios.create({ baseURL: '/api' })

export default function PatientPortal() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [token, setToken] = useState('')
  const [patientName, setPatientName] = useState('')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ mrn: '', phone: '' })
  const [selectedReport, setSelectedReport] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await portalApi.post('/portal/login', form)
      setToken(res.data.access_token)
      setPatientName(res.data.patient_name)
      setLoggedIn(true)
      // Fetch reports
      const r2 = await portalApi.get('/portal/reports', {
        headers: { Authorization: `Bearer ${res.data.access_token}` }
      })
      setReports(r2.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your MRN and phone number.')
    } finally { setLoading(false) }
  }

  const getFlagStyle = (flag) => {
    if (flag === 'H' || flag === 'HH') return 'text-red-600 font-bold'
    if (flag === 'L' || flag === 'LL') return 'text-blue-600 font-bold'
    return 'text-green-600'
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md animate-scaleIn">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🏥</div>
            <h1 className="text-2xl font-bold text-slate-800">Patient Portal</h1>
            <p className="text-sm text-slate-500 mt-1">View your lab reports online</p>
          </div>
          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm animate-slideDown">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MRN (Medical Record Number)</label>
              <input value={form.mrn} onChange={e => setForm({...form, mrn: e.target.value})} required
                placeholder="e.g., PAT001"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required
                placeholder="e.g., 0300-1234567"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 transition-all">
              {loading ? 'Checking...' : 'View My Reports'}
            </button>
          </form>
          <p className="text-xs text-center text-slate-400 mt-4">Your MRN is on your lab receipt</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Welcome, {patientName}</h1>
            <p className="text-sm text-slate-500">{reports.length} report(s) found</p>
          </div>
          <button onClick={() => { setLoggedIn(false); setToken('') }}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">Logout</button>
        </div>

        <div className="space-y-4 animate-stagger">
          {reports.map((r, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border p-6 card-animate">
              <div className="flex justify-between items-center mb-4 cursor-pointer"
                onClick={() => setSelectedReport(selectedReport === i ? null : i)}>
                <div>
                  <h3 className="font-semibold text-slate-800">{r.test_panel || 'Lab Report'}</h3>
                  <p className="text-xs text-slate-500">Sample: {r.sample_id} | {new Date(r.date).toLocaleDateString()}</p>
                </div>
                <span className="text-sm">{selectedReport === i ? '▲' : '▼'}</span>
              </div>

              {selectedReport === i && (
                <div className="animate-slideDown">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2">Test</th>
                        <th className="text-left px-4 py-2">Result</th>
                        <th className="text-left px-4 py-2">Unit</th>
                        <th className="text-left px-4 py-2">Range</th>
                        <th className="text-left px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {r.results.map((res, j) => (
                        <tr key={j}>
                          <td className="px-4 py-2">{res.test_name}</td>
                          <td className={`px-4 py-2 ${getFlagStyle(res.flag)}`}>{res.value}</td>
                          <td className="px-4 py-2 text-slate-500">{res.unit || '-'}</td>
                          <td className="px-4 py-2 text-slate-500">
                            {res.ref_low != null ? `${res.ref_low}-${res.ref_high}` : '-'}
                          </td>
                          <td className={`px-4 py-2 ${getFlagStyle(res.flag)}`}>
                            {res.flag === 'H' ? 'HIGH' : res.flag === 'L' ? 'LOW' : 'Normal'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {reports.length === 0 && (
            <div className="text-center py-12 text-slate-400">No reports found for your account.</div>
          )}
        </div>
      </div>
    </div>
  )
}
