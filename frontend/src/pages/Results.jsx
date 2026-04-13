import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

export default function Results() {
  const { sampleId } = useParams()
  const [results, setResults] = useState([])
  const [sample, setSample] = useState(null)
  const [history, setHistory] = useState({}) // { test_code: [prev_values] }
  const [savingNotes, setSavingNotes] = useState({})
  const [notes, setNotes] = useState({}) // { result_id: noteText }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    fetchResults()
  }, [sampleId])

  const fetchResults = async () => {
    try {
      const [reportRes, resultsRes] = await Promise.all([
        api.get(`/samples/${sampleId}/report`),
        api.get(`/samples/${sampleId}/results`),
      ])
      const sampleData = reportRes.data.sample
      const patient = reportRes.data.patient
      setSample({ ...sampleData, patient })
      const res = resultsRes.data
      setResults(res)

      // Init notes from existing pathologist_notes
      const initialNotes = {}
      res.forEach(r => { initialNotes[r.id] = r.pathologist_notes || '' })
      setNotes(initialNotes)

      // Fetch history for each unique test_code
      if (patient?.id) {
        const uniqueCodes = [...new Set(res.map(r => r.test_code))]
        const historyMap = {}
        await Promise.all(uniqueCodes.map(async (code) => {
          try {
            const h = await api.get(`/patients/${patient.id}/test-history`, {
              params: { test_code: code, limit: 5 }
            })
            // Exclude current sample from history
            historyMap[code] = h.data.filter(x => x.sample_id !== sampleId).slice(0, 3)
          } catch (_) { /* ignore */ }
        }))
        setHistory(historyMap)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const saveNotes = async (resultId) => {
    setSavingNotes(prev => ({ ...prev, [resultId]: true }))
    try {
      await api.put(`/results/${resultId}/notes`, { notes: notes[resultId] || '' })
      setSavedMsg(`Notes saved`)
      setTimeout(() => setSavedMsg(''), 2000)
    } catch (err) {
      alert('Failed to save notes')
    } finally {
      setSavingNotes(prev => ({ ...prev, [resultId]: false }))
    }
  }

  const getFlagStyle = (flag) => {
    switch (flag) {
      case 'HH': return 'text-red-700 font-bold bg-red-50'
      case 'H': return 'text-red-600 font-bold'
      case 'LL': return 'text-blue-700 font-bold bg-blue-50'
      case 'L': return 'text-blue-600 font-bold'
      default: return 'text-green-600'
    }
  }

  const getFlagLabel = (flag) => {
    const labels = { H: 'HIGH ↑', L: 'LOW ↓', HH: '⚠ CRIT HIGH', LL: '⚠ CRIT LOW', N: 'Normal', A: 'ABNORMAL' }
    return labels[flag] || 'Normal'
  }

  const getTrendIcon = (currentVal, prevVal) => {
    const cur = parseFloat(currentVal)
    const prev = parseFloat(prevVal)
    if (isNaN(cur) || isNaN(prev)) return null
    if (cur > prev) return <span className="text-red-500 text-xs ml-1">↑</span>
    if (cur < prev) return <span className="text-blue-500 text-xs ml-1">↓</span>
    return <span className="text-slate-400 text-xs ml-1">→</span>
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Loading results...</div>
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>

  const criticalCount = results.filter(r => r.flag === 'HH' || r.flag === 'LL').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Results: {sampleId}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {results.length} test(s)
            {sample?.patient && <span> · {sample.patient.first_name} {sample.patient.last_name}</span>}
            {criticalCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                ⚠ {criticalCount} Critical
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {savedMsg && (
            <span className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm">{savedMsg}</span>
          )}
          <Link
            to={`/report/${sampleId}`}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            View Report
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Test Name</th>
              <th className="text-left px-4 py-3 font-medium">Result</th>
              <th className="text-left px-4 py-3 font-medium">Unit</th>
              <th className="text-left px-4 py-3 font-medium">Reference Range</th>
              <th className="text-left px-4 py-3 font-medium">Flag</th>
              <th className="text-left px-4 py-3 font-medium">Previous</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((r) => {
              const prev = history[r.test_code] || []
              return (
                <tr key={r.id} className={`hover:bg-slate-50 ${r.flag === 'HH' || r.flag === 'LL' ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">{r.test_name}</td>
                  <td className={`px-4 py-3 ${getFlagStyle(r.flag)}`}>
                    {r.value}
                    {prev.length > 0 && getTrendIcon(r.value, prev[0]?.value)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.unit || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.ref_low != null && r.ref_high != null
                      ? `${r.ref_low} – ${r.ref_high}`
                      : '-'}
                  </td>
                  <td className={`px-4 py-3 text-xs font-semibold ${getFlagStyle(r.flag)}`}>
                    {getFlagLabel(r.flag)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {prev.length > 0 ? (
                      <div className="space-y-0.5">
                        {prev.slice(0, 2).map((p, i) => (
                          <div key={i} className="flex gap-1">
                            <span className="font-medium text-slate-600">{p.value}</span>
                            <span className="text-slate-400">{p.collected_at?.slice(0, 10)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                      {r.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pathologist Notes Section */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-3">Pathologist Notes</h3>
        <div className="space-y-3">
          {results.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-700 text-sm">{r.test_name}</span>
                <span className={`text-xs font-semibold ${getFlagStyle(r.flag)}`}>
                  {getFlagLabel(r.flag)}
                </span>
              </div>
              <div className="flex gap-2">
                <textarea
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Add pathologist comment or clinical note..."
                  value={notes[r.id] || ''}
                  onChange={(e) => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                />
                <button
                  onClick={() => saveNotes(r.id)}
                  disabled={savingNotes[r.id]}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs disabled:opacity-50 self-start"
                >
                  {savingNotes[r.id] ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
