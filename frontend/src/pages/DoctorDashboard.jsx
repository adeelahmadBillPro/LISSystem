import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function DoctorDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('pending')
  const [orderPanel, setOrderPanel] = useState('')
  const [orderPatient, setOrderPatient] = useState('')

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/doctor/dashboard')
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const map = {
      pending: 'bg-yellow-100 text-yellow-700',
      processing: 'bg-blue-100 text-blue-700',
      completed: 'bg-purple-100 text-purple-700',
      verified: 'bg-green-100 text-green-700',
    }
    return map[status] || 'bg-slate-100 text-slate-600'
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Loading...</div>
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>

  const stats = data?.stats || {}
  const samples = tab === 'pending' ? data?.pending || [] : data?.completed || []

  // All unique patients from both pending and completed for the Order Test dropdown
  const allPatients = [...(data?.pending || []), ...(data?.completed || [])].reduce((acc, s) => {
    if (!acc.find(p => p.patient_mrn === s.patient_mrn)) acc.push({ patient_name: s.patient_name, patient_mrn: s.patient_mrn })
    return acc
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Doctor Dashboard</h2>
        {data?.doctor ? (
          <p className="text-sm text-slate-500 mt-1">
            Dr. {data.doctor.name} — {data.doctor.specialization || 'General'}
          </p>
        ) : (
          <p className="text-sm text-amber-600 mt-1">
            No doctor record found linked to your account. Ask admin to add a doctor with your exact name.
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-3xl font-bold text-slate-800">{stats.total || 0}</div>
          <div className="text-xs text-slate-500 mt-1">Total Patients</div>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-center">
          <div className="text-3xl font-bold text-yellow-700">{stats.pending || 0}</div>
          <div className="text-xs text-yellow-600 mt-1">Pending Results</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{stats.completed || 0}</div>
          <div className="text-xs text-green-600 mt-1">Reports Ready</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <div className="text-3xl font-bold text-red-700">{stats.critical || 0}</div>
          <div className="text-xs text-red-600 mt-1">Critical Values</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Pending / In Progress ({data?.pending?.length || 0})
        </button>
        <button
          onClick={() => setTab('completed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'completed'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Verified Reports ({data?.completed?.length || 0})
        </button>
        <button
          onClick={() => setTab('order')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'order'
              ? 'bg-green-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          + Order Test
        </button>
      </div>

      {/* Order Test Panel */}
      {tab === 'order' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-4">
          <h3 className="text-base font-semibold text-slate-700 mb-4">Order a New Test</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Test Panel</label>
              <input
                value={orderPanel}
                onChange={e => setOrderPanel(e.target.value)}
                placeholder="e.g. CBC, LFT, RFT"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Patient</label>
              {allPatients.length > 0 ? (
                <select
                  value={orderPatient}
                  onChange={e => setOrderPatient(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select patient —</option>
                  {allPatients.map(p => (
                    <option key={p.patient_mrn} value={p.patient_mrn}>
                      {p.patient_name} ({p.patient_mrn})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={orderPatient}
                  onChange={e => setOrderPatient(e.target.value)}
                  placeholder="Patient name or MRN"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
            <div>
              <button
                onClick={() => {
                  const doctorId = data?.doctor?.id
                  const params = new URLSearchParams()
                  if (doctorId) params.set('doctor_id', doctorId)
                  if (orderPanel) params.set('panel', orderPanel)
                  navigate(`/samples/new?${params.toString()}`)
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Go to Sample Registration →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {tab !== 'order' && <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        {samples.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            {tab === 'pending' ? 'No pending samples' : 'No verified reports yet'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Sample ID</th>
                <th className="text-left px-4 py-3 font-medium">Patient</th>
                <th className="text-left px-4 py-3 font-medium">MRN</th>
                <th className="text-left px-4 py-3 font-medium">Test Panel</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Critical</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {samples.map((s) => (
                <tr
                  key={s.sample_id}
                  className={`hover:bg-slate-50 ${s.critical_count > 0 ? 'bg-red-50' : ''}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.sample_id}</td>
                  <td className="px-4 py-3 font-medium">{s.patient_name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.patient_mrn}</td>
                  <td className="px-4 py-3 text-slate-600">{s.test_panel || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {s.collected_at ? new Date(s.collected_at).toLocaleDateString('en-PK') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(s.status)}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.critical_count > 0 ? (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        ⚠ {s.critical_count}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        to={`/results/${s.sample_id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Results
                      </Link>
                      {s.status === 'verified' && (
                        <Link
                          to={`/report/${s.sample_id}`}
                          className="text-green-600 hover:underline text-xs"
                        >
                          Report
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>}
    </div>
  )
}
