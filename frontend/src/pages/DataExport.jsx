import { useState } from 'react'
import api from '../api'

export default function DataExport() {
  const [loading, setLoading] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const downloadCSV = async (endpoint, filename) => {
    setLoading(endpoint)
    try {
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo

      const res = await api.get(endpoint, { params, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(err.response?.data?.detail || 'Export failed')
    } finally { setLoading('') }
  }

  const today = new Date().toISOString().slice(0, 10)
  const exports = [
    { endpoint: '/export/patients', filename: `patients_${today}.csv`, label: 'Patients', desc: 'All patient records', icon: '👥', color: 'blue' },
    { endpoint: '/export/results', filename: `results_${today}.csv`, label: 'Test Results', desc: 'All test results with patient info', icon: '🧪', color: 'green' },
    { endpoint: '/export/invoices', filename: `invoices_${today}.csv`, label: 'Invoices', desc: 'All billing invoices', icon: '💰', color: 'purple' },
  ]

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Data Export</h2>
        <p className="text-sm text-slate-500">Download data as CSV files for Excel/accounting</p>
      </div>

      {/* Date Filter */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <h3 className="font-semibold text-slate-700 mb-3">Date Range (optional)</h3>
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={() => { setDateFrom(''); setDateTo('') }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">Clear</button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Leave empty to export all data. Date filter applies to Results and Invoices.</p>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-stagger">
        {exports.map(ex => (
          <div key={ex.endpoint} className="bg-white rounded-2xl shadow-sm border p-6 card-animate">
            <div className="text-3xl mb-3">{ex.icon}</div>
            <h3 className="font-bold text-slate-800 text-lg">{ex.label}</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">{ex.desc}</p>
            <button
              onClick={() => downloadCSV(ex.endpoint, ex.filename)}
              disabled={loading === ex.endpoint}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                loading === ex.endpoint
                  ? 'bg-slate-200 text-slate-500'
                  : `bg-${ex.color}-600 text-white hover:bg-${ex.color}-700`
              }`}
              style={{ backgroundColor: loading !== ex.endpoint ? (ex.color === 'blue' ? '#2563eb' : ex.color === 'green' ? '#16a34a' : '#9333ea') : undefined }}
            >
              {loading === ex.endpoint ? 'Downloading...' : `Download CSV`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
