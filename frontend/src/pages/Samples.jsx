import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function Samples() {
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => { fetchSamples() }, [statusFilter])

  const fetchSamples = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/samples', { params })
      setSamples(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    verified: 'bg-emerald-100 text-emerald-700',
    printed: 'bg-slate-100 text-slate-700',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Samples</h2>
        <Link to="/samples/new" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
          + New Sample
        </Link>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 mb-6">
        {['', 'pending', 'processing', 'completed', 'verified'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              statusFilter === s
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Sample ID</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Test Panel</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Status</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Machine</th>
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
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[s.status] || ''}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">{s.machine_id || '-'}</td>
                <td className="px-6 py-4 text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 space-x-2">
                  <Link to={`/results/${s.sample_id}`} className="text-blue-600 hover:underline">Results</Link>
                  <Link to={`/report/${s.sample_id}`} className="text-green-600 hover:underline">Report</Link>
                </td>
              </tr>
            ))}
            {!loading && samples.length === 0 && (
              <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-400">No samples found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
