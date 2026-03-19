import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

export default function Results() {
  const { sampleId } = useParams()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchResults()
  }, [sampleId])

  const fetchResults = async () => {
    try {
      const res = await api.get(`/samples/${sampleId}/results`)
      setResults(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const getFlagStyle = (flag) => {
    switch (flag) {
      case 'H': case 'HH': return 'text-red-600 font-bold'
      case 'L': case 'LL': return 'text-blue-600 font-bold'
      default: return 'text-green-600'
    }
  }

  const getFlagLabel = (flag) => {
    const labels = { H: 'HIGH', L: 'LOW', HH: 'CRIT HIGH', LL: 'CRIT LOW', N: 'Normal', A: 'ABNORMAL' }
    return labels[flag] || 'Normal'
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Loading results...</div>
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Results: {sampleId}</h2>
          <p className="text-sm text-slate-500 mt-1">{results.length} test(s) found</p>
        </div>
        <Link
          to={`/report/${sampleId}`}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
        >
          View Report
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="text-left px-6 py-3 font-medium">Test Name</th>
              <th className="text-left px-6 py-3 font-medium">Result</th>
              <th className="text-left px-6 py-3 font-medium">Unit</th>
              <th className="text-left px-6 py-3 font-medium">Reference Range</th>
              <th className="text-left px-6 py-3 font-medium">Flag</th>
              <th className="text-left px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{r.test_name}</td>
                <td className={`px-6 py-4 ${getFlagStyle(r.flag)}`}>{r.value}</td>
                <td className="px-6 py-4 text-slate-500">{r.unit || '-'}</td>
                <td className="px-6 py-4 text-slate-500">
                  {r.ref_low != null && r.ref_high != null
                    ? `${r.ref_low} - ${r.ref_high}`
                    : '-'}
                </td>
                <td className={`px-6 py-4 ${getFlagStyle(r.flag)}`}>
                  {getFlagLabel(r.flag)}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
