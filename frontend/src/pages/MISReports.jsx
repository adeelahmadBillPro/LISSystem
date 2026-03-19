import { useState, useEffect } from 'react'
import api from '../api'

export default function MISReports() {
  const [stats, setStats] = useState(null)
  const [dateRange, setDateRange] = useState('today')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [dateRange])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await api.get('/reports/mis', { params: { range: dateRange } })
      setStats(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">MIS Reports</h2>
        <div className="flex gap-2">
          {['today', 'week', 'month'].map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-4 py-2 rounded-lg text-sm ${
                dateRange === r ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">Loading reports...</div>
      ) : stats ? (
        <div>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Samples" value={stats.total_samples} color="bg-blue-500" />
            <StatCard label="Total Revenue" value={`Rs. ${stats.total_revenue?.toLocaleString() || 0}`} color="bg-green-500" />
            <StatCard label="Patients Served" value={stats.patients_served} color="bg-purple-500" />
            <StatCard label="Tests Performed" value={stats.tests_performed} color="bg-orange-500" />
          </div>

          {/* Test Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-700">Test Breakdown</h3>
              </div>
              <div className="p-4">
                {stats.test_breakdown?.length > 0 ? stats.test_breakdown.map((t) => (
                  <div key={t.test_panel} className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm">{t.test_panel}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">{t.count} tests</span>
                      <div className="w-24 bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min((t.count / (stats.total_samples || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center text-slate-400 py-4">No data</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-700">Payment Summary</h3>
              </div>
              <div className="p-4">
                {stats.payment_breakdown?.length > 0 ? stats.payment_breakdown.map((p) => (
                  <div key={p.method} className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm capitalize">{p.method}</span>
                    <span className="text-sm font-bold text-green-700">Rs. {p.total?.toLocaleString() || 0}</span>
                  </div>
                )) : (
                  <div className="text-center text-slate-400 py-4">No data</div>
                )}
              </div>
            </div>
          </div>

          {/* Status Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 mt-6">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">Sample Status Summary</h3>
            </div>
            <div className="grid grid-cols-5 gap-4 p-4">
              {['pending', 'processing', 'completed', 'verified', 'printed'].map((s) => (
                <div key={s} className="text-center">
                  <div className="text-2xl font-bold text-slate-800">
                    {stats.status_breakdown?.[s] || 0}
                  </div>
                  <div className="text-xs text-slate-500 capitalize">{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-red-500">Failed to load reports</div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
      <div className={`w-3 h-3 rounded-full ${color} mb-3`}></div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  )
}
