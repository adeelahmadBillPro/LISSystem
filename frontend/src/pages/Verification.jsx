import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function Verification() {
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSample, setSelectedSample] = useState(null)
  const [results, setResults] = useState([])

  useEffect(() => { fetchPending() }, [])

  const fetchPending = async () => {
    try {
      const res = await api.get('/samples', { params: { status: 'completed' } })
      setSamples(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const viewResults = async (sampleId) => {
    setSelectedSample(sampleId)
    try {
      const res = await api.get(`/samples/${sampleId}/results`)
      setResults(res.data)
    } catch (err) { console.error(err) }
  }

  const verifySample = async (sampleId) => {
    try {
      await api.put(`/samples/${sampleId}/verify`)
      setSelectedSample(null)
      setResults([])
      fetchPending()
    } catch (err) {
      alert(err.response?.data?.detail || 'Verification failed')
    }
  }

  const getFlagStyle = (flag) => {
    switch (flag) {
      case 'H': case 'HH': return 'text-red-600 font-bold'
      case 'L': case 'LL': return 'text-blue-600 font-bold'
      default: return 'text-green-600'
    }
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Loading...</div>

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Result Verification</h2>
      <p className="text-sm text-slate-500 mb-4">
        Review and approve results before they can be printed. ({samples.length} pending)
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Samples List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700">Pending Verification</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {samples.map((s) => (
              <div
                key={s.id}
                onClick={() => viewResults(s.sample_id)}
                className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors ${
                  selectedSample === s.sample_id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{s.sample_id}</div>
                    <div className="text-sm text-slate-500">{s.test_panel || 'General'}</div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
            {samples.length === 0 && (
              <div className="p-8 text-center text-slate-400">All results verified!</div>
            )}
          </div>
        </div>

        {/* Results Detail */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700">
              {selectedSample ? `Results: ${selectedSample}` : 'Select a sample to review'}
            </h3>
          </div>
          {selectedSample && results.length > 0 ? (
            <div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-600">Test</th>
                    <th className="text-left px-4 py-2 text-slate-600">Result</th>
                    <th className="text-left px-4 py-2 text-slate-600">Range</th>
                    <th className="text-left px-4 py-2 text-slate-600">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">{r.test_name}</td>
                      <td className={`px-4 py-2 ${getFlagStyle(r.flag)}`}>{r.value} {r.unit}</td>
                      <td className="px-4 py-2 text-slate-500">
                        {r.ref_low != null ? `${r.ref_low}-${r.ref_high}` : '-'}
                      </td>
                      <td className={`px-4 py-2 ${getFlagStyle(r.flag)}`}>
                        {r.flag === 'H' ? 'HIGH' : r.flag === 'L' ? 'LOW' : 'Normal'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => verifySample(selectedSample)}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Approve & Verify
                </button>
                <Link
                  to={`/report/${selectedSample}`}
                  className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  Preview Report
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              {selectedSample ? 'No results found' : 'Click a sample on the left to review its results'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
