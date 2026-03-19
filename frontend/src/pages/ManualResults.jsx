import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'

export default function ManualResults() {
  const { sampleId } = useParams()
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [results, setResults] = useState([
    { test_code: '', test_name: '', value: '', unit: '', ref_low: '', ref_high: '', flag: '' },
  ])

  useEffect(() => {
    api.get('/tests').then(r => setTests(r.data)).catch(() => {})
  }, [])

  const addRow = () => {
    setResults([...results, { test_code: '', test_name: '', value: '', unit: '', ref_low: '', ref_high: '', flag: '' }])
  }

  const removeRow = (i) => {
    if (results.length <= 1) return
    setResults(results.filter((_, idx) => idx !== i))
  }

  const updateRow = (i, field, value) => {
    const updated = [...results]
    updated[i][field] = value

    // Auto-fill from test catalog
    if (field === 'test_code' && value) {
      const test = tests.find(t => t.test_code === value)
      if (test) {
        updated[i].test_name = test.test_name
        updated[i].unit = test.unit || ''
        updated[i].ref_low = test.ref_low_male || test.ref_low_female || ''
        updated[i].ref_high = test.ref_high_male || test.ref_high_female || ''
      }
    }

    // Auto-flag based on value vs reference range
    if ((field === 'value' || field === 'ref_low' || field === 'ref_high') && updated[i].value) {
      const val = parseFloat(updated[i].value)
      const low = parseFloat(updated[i].ref_low)
      const high = parseFloat(updated[i].ref_high)
      if (!isNaN(val) && !isNaN(low) && !isNaN(high)) {
        if (val > high) updated[i].flag = 'H'
        else if (val < low) updated[i].flag = 'L'
        else updated[i].flag = 'N'
      }
    }

    setResults(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')

    const validResults = results.filter(r => r.test_code && r.test_name && r.value)
    if (validResults.length === 0) {
      setError('Enter at least one result with test code, name, and value')
      return
    }

    setLoading(true)
    try {
      const payload = {
        results: validResults.map(r => ({
          ...r,
          ref_low: r.ref_low ? parseFloat(r.ref_low) : null,
          ref_high: r.ref_high ? parseFloat(r.ref_high) : null,
        })),
      }
      await api.post(`/samples/${sampleId}/manual-results`, payload)
      setSuccess(`${validResults.length} results saved for ${sampleId}`)
      setTimeout(() => navigate(`/results/${sampleId}`), 1500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save results')
    } finally { setLoading(false) }
  }

  const getFlagColor = (flag) => {
    if (flag === 'H') return 'text-red-600 bg-red-50'
    if (flag === 'L') return 'text-blue-600 bg-blue-50'
    if (flag === 'N') return 'text-green-600 bg-green-50'
    return ''
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manual Result Entry</h2>
          <p className="text-sm text-slate-500">Sample: <strong>{sampleId}</strong> — Enter results when machine is offline</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm animate-slideDown">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm animate-slideDown">{success}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-2 text-slate-600 font-medium">Test Code</th>
                <th className="text-left px-3 py-2 text-slate-600 font-medium">Test Name</th>
                <th className="text-left px-3 py-2 text-slate-600 font-medium">Value *</th>
                <th className="text-left px-3 py-2 text-slate-600 font-medium">Unit</th>
                <th className="text-left px-3 py-2 text-slate-600 font-medium">Ref Low</th>
                <th className="text-left px-3 py-2 text-slate-600 font-medium">Ref High</th>
                <th className="text-left px-3 py-2 text-slate-600 font-medium">Flag</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-2 py-1">
                    <select value={r.test_code} onChange={e => updateRow(i, 'test_code', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-xs outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select</option>
                      {tests.map(t => <option key={t.test_code} value={t.test_code}>{t.test_code} - {t.test_name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input value={r.test_name} onChange={e => updateRow(i, 'test_name', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-xs outline-none" placeholder="Auto-filled" />
                  </td>
                  <td className="px-2 py-1">
                    <input value={r.value} onChange={e => updateRow(i, 'value', e.target.value)} required={!!r.test_code}
                      className="w-full px-2 py-1.5 border rounded text-xs outline-none font-bold" placeholder="Enter value" />
                  </td>
                  <td className="px-2 py-1">
                    <input value={r.unit} onChange={e => updateRow(i, 'unit', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-xs outline-none" placeholder="Auto" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" step="0.01" value={r.ref_low} onChange={e => updateRow(i, 'ref_low', e.target.value)}
                      className="w-20 px-2 py-1.5 border rounded text-xs outline-none" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" step="0.01" value={r.ref_high} onChange={e => updateRow(i, 'ref_high', e.target.value)}
                      className="w-20 px-2 py-1.5 border rounded text-xs outline-none" />
                  </td>
                  <td className="px-2 py-1">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getFlagColor(r.flag)}`}>
                      {r.flag === 'H' ? 'HIGH' : r.flag === 'L' ? 'LOW' : r.flag === 'N' ? 'Normal' : '-'}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <button type="button" onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700 text-lg">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <button type="button" onClick={addRow}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm">
            + Add Row
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate(-1)}
              className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm">
              {loading ? 'Saving...' : 'Save Results'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
