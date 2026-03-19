import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

export default function PatientDetail() {
  const { patientId } = useParams()
  const [patient, setPatient] = useState(null)
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')

  useEffect(() => { fetchPatient() }, [patientId])

  const fetchPatient = async () => {
    try {
      const res = await api.get(`/patients/${patientId}`)
      setPatient(res.data)
      setForm(res.data)
      // Fetch patient samples
      const samplesRes = await api.get(`/patients/${patientId}/samples`)
      setSamples(samplesRes.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.put(`/patients/${patientId}`, {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        address: form.address,
        gender: form.gender,
        dob: form.dob,
      })
      setEditing(false)
      fetchPatient()
    } catch (err) {
      setError(err.response?.data?.detail || 'Update failed')
    }
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    verified: 'bg-emerald-100 text-emerald-700',
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Loading...</div>
  if (!patient) return <div className="text-center py-20 text-red-500">Patient not found</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{patient.full_name}</h2>
          <p className="text-sm text-slate-500">MRN: {patient.mrn} | {patient.age ?? 'N/A'} yrs | {patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : '-'}</p>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {editing ? 'Cancel' : 'Edit Patient'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {/* Patient Info / Edit Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                <input value={form.first_name || ''} onChange={(e) => setForm({...form, first_name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                <input value={form.last_name || ''} onChange={(e) => setForm({...form, last_name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input value={form.phone || ''} onChange={(e) => setForm({...form, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                <select value={form.gender || ''} onChange={(e) => setForm({...form, gender: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="M">Male</option><option value="F">Female</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <textarea value={form.address || ''} onChange={(e) => setForm({...form, address: e.target.value})} rows="2"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
          </form>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-slate-500">MRN:</span><br/><strong>{patient.mrn}</strong></div>
            <div><span className="text-slate-500">Phone:</span><br/><strong>{patient.phone || '-'}</strong></div>
            <div><span className="text-slate-500">Date of Birth:</span><br/><strong>{patient.dob || '-'}</strong></div>
            <div><span className="text-slate-500">Registered:</span><br/><strong>{new Date(patient.created_at).toLocaleDateString()}</strong></div>
          </div>
        )}
      </div>

      {/* Sample History */}
      <h3 className="text-lg font-semibold text-slate-800 mb-3">Sample History</h3>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Sample ID</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Test Panel</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Status</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Date</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {samples.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{s.sample_id}</td>
                <td className="px-6 py-4">{s.test_panel || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[s.status] || 'bg-slate-100 text-slate-600'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 space-x-2">
                  <Link to={`/results/${s.sample_id}`} className="text-blue-600 hover:underline">Results</Link>
                  <Link to={`/report/${s.sample_id}`} className="text-green-600 hover:underline">Report</Link>
                </td>
              </tr>
            ))}
            {samples.length === 0 && (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">No samples for this patient</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
