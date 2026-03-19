import { useState, useEffect } from 'react'
import api from '../api'

export default function DailyClosing() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => { fetchReport() }, [selectedDate])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const r = await api.get('/reports/daily-closing', { params: { report_date: selectedDate } })
      setReport(r.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Daily Cash Closing</h2>
        <div className="flex gap-3 items-center">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm print:hidden">
            Print Report
          </button>
        </div>
      </div>

      {loading ? <div className="text-center py-20 text-slate-500">Loading...</div> : report && (
        <div>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-stagger">
            <div className="bg-white rounded-2xl shadow-sm border p-5 hover-lift">
              <div className="text-sm text-slate-500">Total Collection</div>
              <div className="text-2xl font-bold text-green-700">Rs. {report.total_collection.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border p-5 hover-lift">
              <div className="text-sm text-slate-500">Invoices</div>
              <div className="text-2xl font-bold text-slate-800">{report.total_invoices}</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border p-5 hover-lift">
              <div className="text-sm text-slate-500">Samples</div>
              <div className="text-2xl font-bold text-blue-700">{report.samples_count}</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border p-5 hover-lift">
              <div className="text-sm text-slate-500">Patients</div>
              <div className="text-2xl font-bold text-purple-700">{report.patients_count}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h3 className="font-semibold text-slate-700 mb-4">Payment Breakdown</h3>
              {report.payment_breakdown.map(p => (
                <div key={p.method} className="flex justify-between py-2 border-b border-slate-50">
                  <span className="capitalize">{p.method}</span>
                  <span className="font-bold text-green-700">Rs. {p.amount.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 font-bold text-lg border-t-2 mt-2">
                <span>Total</span>
                <span className="text-green-700">Rs. {report.total_collection.toLocaleString()}</span>
              </div>
            </div>

            {/* Invoice List */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b"><h3 className="font-semibold text-slate-700">Invoices</h3></div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-slate-600">#</th>
                      <th className="text-left px-4 py-2 text-slate-600">Time</th>
                      <th className="text-left px-4 py-2 text-slate-600">Amount</th>
                      <th className="text-left px-4 py-2 text-slate-600">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {report.invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2">INV-{String(inv.id).padStart(5, '0')}</td>
                        <td className="px-4 py-2 text-slate-500">{inv.time}</td>
                        <td className="px-4 py-2 font-medium">Rs. {inv.amount}</td>
                        <td className="px-4 py-2 capitalize text-slate-500">{inv.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
