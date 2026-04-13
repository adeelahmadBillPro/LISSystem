import { useState, useEffect, useContext } from 'react'
import api from '../api'
import { ThemeContext } from '../App'

const METHOD_ICON = { cash: '💵', card: '💳', online: '📲', insurance: '🏥', credit: '📒' }
const METHOD_COLOR = {
  cash: 'bg-green-100 text-green-700',
  card: 'bg-blue-100 text-blue-700',
  online: 'bg-cyan-100 text-cyan-700',
  insurance: 'bg-purple-100 text-purple-700',
  credit: 'bg-orange-100 text-orange-700',
}

export default function DailyClosing() {
  const { darkMode } = useContext(ThemeContext)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [expandedInv, setExpandedInv] = useState(false)

  useEffect(() => { fetchReport() }, [selectedDate])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const r = await api.get('/reports/daily-closing', { params: { report_date: selectedDate } })
      setReport(r.data)
    } catch {}
    finally { setLoading(false) }
  }

  const card = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'

  const cashTotal = report?.payment_breakdown?.find(p => p.method === 'cash')?.amount || 0
  const cardTotal = report?.payment_breakdown?.find(p => p.method === 'card')?.amount || 0
  const onlineTotal = report?.payment_breakdown?.find(p => p.method === 'online')?.amount || 0
  const insuranceTotal = report?.payment_breakdown?.find(p => p.method === 'insurance')?.amount || 0

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Daily Cash Closing</h2>
          <p className="text-sm text-slate-500">End-of-day collection summary &amp; staff accountability</p>
        </div>
        <div className="flex gap-3 items-center">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm hover:bg-slate-700 flex items-center gap-2">
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-6 border-b-2 border-slate-800 pb-4">
        <h1 className="text-xl font-bold">Daily Closing Report</h1>
        <p className="text-sm text-slate-500">Date: {selectedDate}</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">Loading...</div>
      ) : report ? (
        <div>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Collection', value: `Rs. ${report.total_collection.toLocaleString()}`, icon: '💰', color: 'text-green-600', bg: darkMode ? 'bg-green-900/20' : 'bg-green-50' },
              { label: 'Invoices', value: report.total_invoices, icon: '🧾', color: 'text-blue-600', bg: darkMode ? 'bg-blue-900/20' : 'bg-blue-50' },
              { label: 'Samples', value: report.samples_count, icon: '🧪', color: 'text-purple-600', bg: darkMode ? 'bg-purple-900/20' : 'bg-purple-50' },
              { label: 'Patients', value: report.patients_count, icon: '👤', color: 'text-orange-600', bg: darkMode ? 'bg-orange-900/20' : 'bg-orange-50' },
            ].map((s, i) => (
              <div key={i} className={`rounded-2xl border p-5 shadow-sm ${card} ${s.bg}`}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Payment Breakdown — visual bars */}
            <div className={`rounded-2xl border shadow-sm p-6 ${card}`}>
              <h3 className="font-semibold text-slate-700 dark:text-white mb-4">Payment Breakdown</h3>
              <div className="space-y-3">
                {report.payment_breakdown.map(p => {
                  const pct = report.total_collection > 0 ? (p.amount / report.total_collection) * 100 : 0
                  return (
                    <div key={p.method}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="flex items-center gap-1.5 text-sm capitalize font-medium">
                          {METHOD_ICON[p.method] || '💰'} {p.method}
                        </span>
                        <span className="font-bold text-green-600 text-sm">Rs. {p.amount.toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-green-500 transition-all duration-500"
                          style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{pct.toFixed(1)}% of total</div>
                    </div>
                  )
                })}
                <div className={`flex justify-between py-3 font-bold text-lg border-t mt-2 ${darkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                  <span>Grand Total</span>
                  <span className="text-green-600">Rs. {report.total_collection.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Staff Collection */}
            <div className={`rounded-2xl border shadow-sm p-6 ${card}`}>
              <h3 className="font-semibold text-slate-700 dark:text-white mb-4">Collection by Staff</h3>
              {report.staff_breakdown?.length > 0 ? (
                <div className="space-y-3">
                  {report.staff_breakdown.map(s => {
                    const pct = report.total_collection > 0 ? (s.amount / report.total_collection) * 100 : 0
                    return (
                      <div key={s.staff}>
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${darkMode ? 'bg-blue-800 text-blue-200' : 'bg-blue-100 text-blue-700'}`}>
                              {s.staff.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-sm font-medium">{s.staff}</span>
                          </div>
                          <span className="font-bold text-green-600 text-sm">Rs. {s.amount.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 ml-9">
                          <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center text-slate-400 py-8 text-sm">No staff data</div>
              )}
            </div>
          </div>

          {/* Invoice Detail Table */}
          <div className={`rounded-2xl border shadow-sm overflow-hidden mb-6 ${card}`}>
            <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <h3 className="font-semibold text-slate-700 dark:text-white">Invoice Details ({report.invoices?.length || 0})</h3>
              <button onClick={() => setExpandedInv(!expandedInv)} className="text-xs text-blue-600 hover:underline print:hidden">
                {expandedInv ? '▲ Collapse' : '▼ Expand All'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-500'}`}>
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">Time</th>
                    <th className="text-left px-4 py-3">Patient</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-center px-4 py-3">Disc.</th>
                    <th className="text-left px-4 py-3">Method</th>
                    <th className="text-left px-4 py-3">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(expandedInv ? report.invoices : report.invoices?.slice(0, 10))?.map(inv => (
                    <tr key={inv.id} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-2.5 font-mono text-xs">INV-{String(inv.id).padStart(5,'0')}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{inv.time}</td>
                      <td className="px-4 py-2.5 font-medium">{inv.patient_name}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-green-600">Rs. {inv.amount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center text-slate-400 text-xs">{inv.discount > 0 ? `${inv.discount}%` : '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${METHOD_COLOR[inv.method] || 'bg-slate-100 text-slate-600'}`}>
                          {METHOD_ICON[inv.method] || ''} {inv.method}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-blue-50 text-blue-700'}`}>{inv.created_by}</span>
                      </td>
                    </tr>
                  ))}
                  {!expandedInv && report.invoices?.length > 10 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-2 text-center text-xs text-slate-400">
                        +{report.invoices.length - 10} more invoices —
                        <button onClick={() => setExpandedInv(true)} className="text-blue-600 hover:underline ml-1">show all</button>
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Footer totals */}
                <tfoot>
                  <tr className={`font-bold border-t-2 text-sm ${darkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-300 bg-slate-50'}`}>
                    <td colSpan={3} className="px-4 py-3">TOTAL ({report.invoices?.length} invoices)</td>
                    <td className="px-4 py-3 text-right text-green-600">Rs. {report.total_collection.toLocaleString()}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Staff Activity Log */}
          {report.staff_activity?.length > 0 && (
            <div className={`rounded-2xl border shadow-sm overflow-hidden mb-6 print:hidden ${card}`}>
              <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                <h3 className="font-semibold text-slate-700 dark:text-white">Staff Activity Log</h3>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`text-xs font-semibold uppercase tracking-wide sticky top-0 ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-500'}`}>
                      <th className="text-left px-4 py-2">Time</th>
                      <th className="text-left px-4 py-2">Staff</th>
                      <th className="text-left px-4 py-2">Action</th>
                      <th className="text-left px-4 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {report.staff_activity.map((a, i) => (
                      <tr key={i} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-2 text-slate-400">{a.time}</td>
                        <td className="px-4 py-2 font-medium">{a.user}</td>
                        <td className="px-4 py-2"><span className="px-1.5 py-0.5 bg-slate-100 rounded">{a.action}</span></td>
                        <td className="px-4 py-2 text-slate-500 truncate max-w-xs">{a.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cash Handover (Print) */}
          <div className={`rounded-2xl border shadow-sm p-6 ${card}`}>
            <h3 className="font-semibold text-slate-700 dark:text-white mb-5">Cash Handover Sheet</h3>
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 rounded-xl p-4 mb-6 ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
              {[
                { label: 'Cash', amount: cashTotal, icon: '💵' },
                { label: 'Card / POS', amount: cardTotal, icon: '💳' },
                { label: 'Online', amount: onlineTotal, icon: '📲' },
                { label: 'Insurance', amount: insuranceTotal, icon: '🏥' },
              ].map(p => (
                <div key={p.label} className={`rounded-lg p-3 border text-center ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
                  <div className="text-xl mb-1">{p.icon}</div>
                  <div className="text-xs text-slate-500">{p.label}</div>
                  <div className={`font-bold text-sm mt-0.5 ${p.amount > 0 ? 'text-green-600' : 'text-slate-400'}`}>Rs. {p.amount.toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div className={`text-lg font-bold text-center py-3 rounded-xl ${darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'} mb-6`}>
              Grand Total: Rs. {report.total_collection.toLocaleString()}
            </div>
            <div className="grid grid-cols-2 gap-8">
              {['Handed Over By', 'Received By (Manager)'].map(label => (
                <div key={label}>
                  <p className="text-sm text-slate-500 mb-10">{label}:</p>
                  <div className={`border-b-2 mb-1 ${darkMode ? 'border-slate-500' : 'border-slate-400'}`}></div>
                  <p className="text-xs text-slate-400">Signature &amp; Name</p>
                  <p className="text-xs text-slate-400 mt-2">Date: {selectedDate} &nbsp;&nbsp; Time: ___________</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div className="text-center py-20 text-slate-400">No data for selected date</div>
      )}
    </div>
  )
}
