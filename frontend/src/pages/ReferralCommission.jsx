import { useState, useEffect, useContext } from 'react'
import api from '../api'
import { ThemeContext } from '../App'

export default function ReferralCommission() {
  const { darkMode } = useContext(ThemeContext)
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'

  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(today)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState({})
  // commission rates per doctor (local state — editable per row)
  const [rates, setRates] = useState({})

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/referral/commission', { params: { from_date: fromDate, to_date: toDate } })
      setData(res.data)
      // init rates at 10% for any new doctor
      setRates(prev => {
        const next = { ...prev }
        res.data.forEach(d => {
          if (!(d.doctor_id in next)) next[d.doctor_id] = 10
        })
        return next
      })
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const totalBilled = data.reduce((a, d) => a + d.total_billed, 0)
  const totalCommission = data.reduce((a, d) => a + (d.total_billed * (rates[d.doctor_id] || 0) / 100), 0)
  const totalSamples = data.reduce((a, d) => a + d.sample_count, 0)

  const handlePrint = () => window.print()

  const card = darkMode
    ? 'bg-slate-800 border-slate-700'
    : 'bg-white border-slate-100'

  return (
    <div className="animate-fadeIn max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Referral Commission</h2>
          <p className="text-sm text-slate-500 mt-1">Doctor-wise patient referrals & commission calculation</p>
        </div>
        <button onClick={handlePrint}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm flex items-center gap-2 print:hidden">
          🖨️ Print Report
        </button>
      </div>

      {/* Filters */}
      <div className={`rounded-xl border p-4 mb-6 flex flex-wrap gap-4 items-end print:hidden ${card} shadow-sm`}>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <button onClick={load} disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
          {loading ? '⏳ Loading...' : '🔍 Search'}
        </button>
        {/* Quick range buttons */}
        <div className="flex gap-2 ml-auto">
          {[
            { label: 'This Month', from: firstOfMonth, to: today },
            { label: 'Last 7 Days', from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0,10), to: today },
            { label: 'This Year', from: today.slice(0,4) + '-01-01', to: today },
          ].map(r => (
            <button key={r.label} onClick={() => { setFromDate(r.from); setToDate(r.to) }}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600">
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Doctors with Referrals', value: data.length, icon: '🩺', color: 'blue' },
          { label: 'Total Samples Referred', value: totalSamples, icon: '🧪', color: 'purple' },
          { label: 'Total Billed', value: `Rs. ${totalBilled.toLocaleString()}`, icon: '💰', color: 'green' },
          { label: 'Total Commission', value: `Rs. ${Math.round(totalCommission).toLocaleString()}`, icon: '💵', color: 'orange' },
        ].map((s, i) => (
          <div key={i} className={`rounded-xl border p-4 shadow-sm ${card}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{s.icon}</span>
              <span className="text-xs text-slate-500">{s.label}</span>
            </div>
            <div className={`text-xl font-extrabold ${
              s.color === 'blue' ? 'text-blue-600' :
              s.color === 'purple' ? 'text-purple-600' :
              s.color === 'green' ? 'text-green-600' : 'text-orange-600'
            }`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Commission note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-sm text-blue-700 flex items-start gap-2 print:hidden">
        <span className="text-lg flex-shrink-0">💡</span>
        <span>
          Commission % is <strong>editable per doctor</strong> — type the rate in the % column.
          Rates are not saved to database; set them each time or note them separately.
        </span>
      </div>

      {/* Table */}
      {data.length === 0 && !loading ? (
        <div className={`rounded-xl border p-16 text-center ${card} shadow-sm`}>
          <div className="text-4xl mb-3">🩺</div>
          <div className="font-semibold text-slate-600">No referral data found</div>
          <div className="text-sm text-slate-400 mt-1">No samples with referring doctors in this date range</div>
        </div>
      ) : (
        <div className={`rounded-xl border shadow-sm overflow-hidden ${card}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-500'}`}>
                <th className="text-left px-4 py-3">Doctor</th>
                <th className="text-center px-4 py-3">Samples</th>
                <th className="text-center px-4 py-3">Patients</th>
                <th className="text-right px-4 py-3">Total Billed</th>
                <th className="text-center px-3 py-3 w-28">Commission %</th>
                <th className="text-right px-4 py-3">Commission Earned</th>
                <th className="px-4 py-3 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((doc, i) => {
                const rate = rates[doc.doctor_id] ?? 10
                const commission = doc.total_billed * rate / 100
                const isExpanded = expanded[doc.doctor_id]
                return [
                  <tr key={doc.doctor_id}
                    className={`transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'} ${i % 2 === 0 ? '' : darkMode ? 'bg-slate-750' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{doc.doctor_name}</div>
                      {doc.specialization && <div className="text-xs text-slate-400">{doc.specialization}</div>}
                      {doc.doctor_phone && <div className="text-xs text-slate-400">📞 {doc.doctor_phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{doc.sample_count}</td>
                    <td className="px-4 py-3 text-center font-medium">{doc.patient_count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      Rs. {doc.total_billed.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center gap-1 justify-center print:hidden">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={rate}
                          onChange={e => setRates(p => ({ ...p, [doc.doctor_id]: parseFloat(e.target.value) || 0 }))}
                          className="w-14 text-center px-1 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-slate-500 text-xs">%</span>
                      </div>
                      <div className="hidden print:block">{rate}%</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-orange-600">
                      Rs. {Math.round(commission).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 print:hidden">
                      <button onClick={() => toggle(doc.doctor_id)}
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                        {isExpanded ? '▲ Hide' : '▼ Details'}
                      </button>
                    </td>
                  </tr>,
                  // Expanded detail rows
                  isExpanded && (
                    <tr key={`${doc.doctor_id}-detail`} className={darkMode ? 'bg-slate-900' : 'bg-blue-50/40'}>
                      <td colSpan={7} className="px-4 py-3">
                        <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                          Patient / Sample Breakdown
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-400">
                                <th className="text-left pb-1">#</th>
                                <th className="text-left pb-1">Patient</th>
                                <th className="text-left pb-1">MRN</th>
                                <th className="text-left pb-1">Sample ID</th>
                                <th className="text-left pb-1">Test Panel</th>
                                <th className="text-left pb-1">Date</th>
                                <th className="text-right pb-1">Billed</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/50">
                              {doc.records.map((r, idx) => (
                                <tr key={idx} className={darkMode ? 'hover:bg-slate-800' : 'hover:bg-white'}>
                                  <td className="py-1 pr-2 text-slate-400">{idx + 1}</td>
                                  <td className="py-1 pr-4 font-medium">{r.patient_name}</td>
                                  <td className="py-1 pr-4 text-slate-400">{r.patient_mrn}</td>
                                  <td className="py-1 pr-4 text-slate-400 font-mono">{r.sample_id}</td>
                                  <td className="py-1 pr-4 text-slate-500">{r.test_panel || '—'}</td>
                                  <td className="py-1 pr-4 text-slate-500">{r.collected_at}</td>
                                  <td className="py-1 text-right font-medium text-green-600">
                                    {r.billed_amount > 0 ? `Rs. ${r.billed_amount.toLocaleString()}` : <span className="text-slate-400">—</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-slate-300 font-semibold">
                                <td colSpan={6} className="pt-1.5 text-right text-slate-600 pr-4">Total:</td>
                                <td className="pt-1.5 text-right text-green-700">Rs. {doc.total_billed.toLocaleString()}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )
                ]
              })}
            </tbody>
            {/* Footer totals */}
            <tfoot>
              <tr className={`font-bold border-t-2 ${darkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-300 bg-slate-50'}`}>
                <td className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3 text-center">{totalSamples}</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right text-green-600">Rs. {totalBilled.toLocaleString()}</td>
                <td></td>
                <td className="px-4 py-3 text-right text-orange-600">Rs. {Math.round(totalCommission).toLocaleString()}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Print footer */}
      <div className="hidden print:block mt-8 text-xs text-slate-400 text-center border-t pt-4">
        Referral Commission Report | Period: {fromDate} to {toDate} | Generated: {new Date().toLocaleString('en-PK')}
      </div>
    </div>
  )
}
