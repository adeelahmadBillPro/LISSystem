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
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Daily Cash Closing</h2>
          <p className="text-sm text-slate-500">End-of-day collection summary & staff accountability</p>
        </div>
        <div className="flex gap-3 items-center print:hidden">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

            {/* Staff Collection Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h3 className="font-semibold text-slate-700 mb-4">Collection by Staff</h3>
              {report.staff_breakdown?.length > 0 ? report.staff_breakdown.map(s => (
                <div key={s.staff} className="flex justify-between py-2 border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                      {s.staff.charAt(0)}
                    </span>
                    <span>{s.staff}</span>
                  </div>
                  <span className="font-bold text-green-700">Rs. {s.amount.toLocaleString()}</span>
                </div>
              )) : (
                <div className="text-center text-slate-400 py-4 text-sm">No staff data</div>
              )}
            </div>
          </div>

          {/* Invoice Detail Table */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">
            <div className="p-4 border-b"><h3 className="font-semibold text-slate-700">Invoice Details</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-600">#</th>
                    <th className="text-left px-4 py-3 text-slate-600">Time</th>
                    <th className="text-left px-4 py-3 text-slate-600">Patient</th>
                    <th className="text-left px-4 py-3 text-slate-600">Amount</th>
                    <th className="text-left px-4 py-3 text-slate-600">Discount</th>
                    <th className="text-left px-4 py-3 text-slate-600">Method</th>
                    <th className="text-left px-4 py-3 text-slate-600">Collected By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {report.invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">INV-{String(inv.id).padStart(5, '0')}</td>
                      <td className="px-4 py-3 text-slate-500">{inv.time}</td>
                      <td className="px-4 py-3">{inv.patient_name}</td>
                      <td className="px-4 py-3 font-bold text-green-700">Rs. {inv.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{inv.discount}%</td>
                      <td className="px-4 py-3 capitalize">{inv.method}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{inv.created_by}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Staff Activity Log */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">
            <div className="p-4 border-b"><h3 className="font-semibold text-slate-700">Staff Activity Log</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-600">Time</th>
                    <th className="text-left px-4 py-3 text-slate-600">Staff</th>
                    <th className="text-left px-4 py-3 text-slate-600">Action</th>
                    <th className="text-left px-4 py-3 text-slate-600">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {report.staff_activity?.map((a, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-500">{a.time}</td>
                      <td className="px-4 py-2 font-medium">{a.user}</td>
                      <td className="px-4 py-2"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{a.action}</span></td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{a.details}</td>
                    </tr>
                  ))}
                  {(!report.staff_activity || report.staff_activity.length === 0) && (
                    <tr><td colSpan="4" className="px-4 py-4 text-center text-slate-400 text-sm">No activity logged today</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cash Handover Section (Print) */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h3 className="font-semibold text-slate-700 mb-4">Cash Handover</h3>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-sm text-slate-500 mb-8">Handed Over By:</p>
                <div className="border-b border-slate-300 mb-2"></div>
                <p className="text-xs text-slate-400">Name & Signature</p>
                <p className="text-xs text-slate-400 mt-4">Date: {selectedDate} &nbsp;&nbsp; Time: ___________</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-8">Received By:</p>
                <div className="border-b border-slate-300 mb-2"></div>
                <p className="text-xs text-slate-400">Name & Signature</p>
                <p className="text-xs text-slate-400 mt-4">Date: {selectedDate} &nbsp;&nbsp; Time: ___________</p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-slate-500">Total Cash:</span> <strong className="text-green-700">Rs. {(report.payment_breakdown.find(p => p.method === 'cash')?.amount || 0).toLocaleString()}</strong></div>
                <div><span className="text-slate-500">Total Card:</span> <strong>Rs. {(report.payment_breakdown.find(p => p.method === 'card')?.amount || 0).toLocaleString()}</strong></div>
                <div><span className="text-slate-500">Grand Total:</span> <strong className="text-green-700 text-lg">Rs. {report.total_collection.toLocaleString()}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
