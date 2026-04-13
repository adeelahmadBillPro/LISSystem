import { useState, useEffect, useContext } from 'react'
import api from '../api'
import { ThemeContext } from '../App'

const METHOD_COLOR = { cash: '#22c55e', card: '#3b82f6', online: '#06b6d4', insurance: '#a855f7', credit: '#f97316' }

export default function MISReports() {
  const { darkMode } = useContext(ThemeContext)
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'

  const [mode, setMode] = useState('preset')   // preset | custom
  const [preset, setPreset] = useState('month')
  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(today)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [preset, mode])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const params = mode === 'preset' ? { range: preset } : { range: 'custom', from_date: fromDate, to_date: toDate }
      const res = await api.get('/reports/mis', { params })
      setStats(res.data)
    } catch {}
    finally { setLoading(false) }
  }

  const handleCustomSearch = () => fetchStats()

  const card = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'

  // Max for bar chart scale
  const maxTestCount = Math.max(...(stats?.test_breakdown?.map(t => t.count) || [1]), 1)
  const maxDayRevenue = Math.max(...(stats?.daily_trend?.map(d => d.revenue) || [1]), 1)

  const totalPayment = stats?.payment_breakdown?.reduce((a, p) => a + (p.total || 0), 0) || 0

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">MIS Reports</h2>
          <p className="text-sm text-slate-500">Management Information System — analytics &amp; trends</p>
        </div>
        <button onClick={() => window.print()}
          className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm hover:bg-slate-700 print:hidden flex items-center gap-2">
          🖨️ Print
        </button>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border p-4 mb-6 print:hidden shadow-sm ${card}`}>
        <div className="flex flex-wrap gap-3 items-end">
          {/* Preset buttons */}
          <div className="flex gap-1.5">
            {[['today','Today'],['week','This Week'],['month','This Month'],['year','This Year']].map(([val, label]) => (
              <button key={val} onClick={() => { setMode('preset'); setPreset(val) }}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  mode === 'preset' && preset === val ? 'bg-blue-600 text-white shadow' : `${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'} hover:bg-blue-50 hover:text-blue-700`
                }`}>
                {label}
              </button>
            ))}
          </div>

          <div className="w-px h-8 bg-slate-200 hidden md:block" />

          {/* Custom range */}
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-1">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="px-2.5 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-1">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="px-2.5 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <button onClick={() => { setMode('custom'); handleCustomSearch() }}
              className={`px-4 py-2 rounded-xl text-xs font-medium ${mode === 'custom' ? 'bg-blue-600 text-white' : 'border border-blue-300 text-blue-600 hover:bg-blue-50'}`}>
              🔍 Apply
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">⏳ Loading reports...</div>
      ) : stats ? (
        <div className="space-y-6">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Samples', value: stats.total_samples, icon: '🧪', color: 'blue', sub: '' },
              { label: 'Total Revenue', value: `Rs. ${(stats.total_revenue || 0).toLocaleString()}`, icon: '💰', color: 'green', sub: '' },
              { label: 'Patients Served', value: stats.patients_served, icon: '👤', color: 'purple', sub: '' },
              { label: 'Tests Performed', value: stats.tests_performed, icon: '🔬', color: 'orange', sub: '' },
            ].map((s, i) => (
              <div key={i} className={`rounded-2xl border p-5 shadow-sm ${card}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-2xl font-extrabold text-slate-800 dark:text-white">{s.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                  <span className="text-2xl">{s.icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Status Funnel */}
          <div className={`rounded-2xl border shadow-sm p-6 ${card}`}>
            <h3 className="font-semibold text-slate-700 dark:text-white mb-4">Sample Status Funnel</h3>
            <div className="flex items-end gap-3 overflow-x-auto pb-2">
              {[
                { key: 'pending', label: 'Pending', color: 'bg-yellow-400' },
                { key: 'processing', label: 'Processing', color: 'bg-blue-400' },
                { key: 'completed', label: 'Completed', color: 'bg-indigo-500' },
                { key: 'verified', label: 'Verified', color: 'bg-green-500' },
                { key: 'printed', label: 'Printed', color: 'bg-slate-500' },
              ].map((s, i) => {
                const count = stats.status_breakdown?.[s.key] || 0
                const maxCount = Math.max(...Object.values(stats.status_breakdown || {}), 1)
                const pct = Math.max((count / maxCount) * 100, 4)
                return (
                  <div key={s.key} className="flex-1 min-w-[60px] flex flex-col items-center">
                    <div className="text-sm font-bold text-slate-700 dark:text-white mb-1">{count}</div>
                    <div className={`w-full rounded-t-lg ${s.color} transition-all`} style={{ height: `${pct * 1.2}px` }} />
                    <div className="text-[10px] text-slate-500 mt-1 text-center">{s.label}</div>
                    {i < 4 && <div className="text-slate-300 text-xs mt-0.5">→</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Revenue Daily Trend */}
          {stats.daily_trend?.length > 0 && (
            <div className={`rounded-2xl border shadow-sm p-6 ${card}`}>
              <h3 className="font-semibold text-slate-700 dark:text-white mb-4">Revenue Trend</h3>
              <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: '120px' }}>
                {stats.daily_trend.map((d, i) => {
                  const pct = maxDayRevenue > 0 ? (d.revenue / maxDayRevenue) * 100 : 0
                  return (
                    <div key={i} className="flex-1 min-w-[18px] flex flex-col items-center group relative">
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                        Rs. {d.revenue.toLocaleString()}
                      </div>
                      <div className="w-full rounded-t bg-blue-500 hover:bg-blue-400 transition-all cursor-default"
                        style={{ height: `${Math.max(pct * 1.0, 2)}px` }} />
                      <div className="text-[9px] text-slate-400 mt-1 rotate-45 origin-left ml-1 hidden sm:block">
                        {d.date?.slice(5)}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="text-xs text-slate-400 text-center mt-6">Hover bars to see exact values</div>
            </div>
          )}

          {/* Test + Payment row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Tests */}
            <div className={`rounded-2xl border shadow-sm p-6 ${card}`}>
              <h3 className="font-semibold text-slate-700 dark:text-white mb-4">Top Tests</h3>
              {stats.test_breakdown?.length > 0 ? (
                <div className="space-y-2.5">
                  {stats.test_breakdown.slice(0, 10).map((t, i) => {
                    const pct = (t.count / maxTestCount) * 100
                    return (
                      <div key={t.test_panel}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium flex items-center gap-1.5">
                            <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${darkMode ? 'bg-blue-800 text-blue-200' : 'bg-blue-100 text-blue-600'}`}>{i+1}</span>
                            {t.test_panel}
                          </span>
                          <span className="text-slate-500 font-medium">{t.count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100">
                          <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : <div className="text-center text-slate-400 py-6 text-sm">No data</div>}
            </div>

            {/* Payment Method Breakdown */}
            <div className={`rounded-2xl border shadow-sm p-6 ${card}`}>
              <h3 className="font-semibold text-slate-700 dark:text-white mb-4">Payment Methods</h3>
              {stats.payment_breakdown?.length > 0 ? (
                <div className="space-y-3">
                  {/* Segmented bar */}
                  <div className="flex rounded-full overflow-hidden h-5 mb-4">
                    {stats.payment_breakdown.map(p => {
                      const pct = totalPayment > 0 ? (p.total / totalPayment) * 100 : 0
                      return pct > 0 ? (
                        <div key={p.method} title={`${p.method}: Rs.${p.total?.toLocaleString()}`}
                          className="transition-all cursor-default"
                          style={{ width: `${pct}%`, backgroundColor: METHOD_COLOR[p.method] || '#94a3b8' }} />
                      ) : null
                    })}
                  </div>
                  {stats.payment_breakdown.map(p => {
                    const pct = totalPayment > 0 ? (p.total / totalPayment) * 100 : 0
                    return (
                      <div key={p.method} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: METHOD_COLOR[p.method] || '#94a3b8' }} />
                          <span className="text-sm capitalize font-medium">{p.method}</span>
                          <span className="text-xs text-slate-400">{pct.toFixed(1)}%</span>
                        </div>
                        <span className="font-bold text-green-600 text-sm">Rs. {(p.total || 0).toLocaleString()}</span>
                      </div>
                    )
                  })}
                  <div className={`flex justify-between font-bold border-t pt-2 mt-1 ${darkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                    <span className="text-sm">Total Revenue</span>
                    <span className="text-green-600">Rs. {totalPayment.toLocaleString()}</span>
                  </div>
                </div>
              ) : <div className="text-center text-slate-400 py-6 text-sm">No data</div>}
            </div>
          </div>

          {/* Doctor Referral stats (if available) */}
          {stats.top_doctors?.length > 0 && (
            <div className={`rounded-2xl border shadow-sm p-6 ${card}`}>
              <h3 className="font-semibold text-slate-700 dark:text-white mb-4">Top Referring Doctors</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.top_doctors.slice(0, 6).map((d, i) => (
                  <div key={d.doctor} className={`flex items-center gap-3 p-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                    <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-200 text-slate-600' : 'bg-orange-100 text-orange-600'
                    }`}>{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{d.doctor}</div>
                      <div className="text-xs text-slate-400">{d.sample_count} referrals</div>
                    </div>
                    <div className="text-xs font-bold text-green-600">Rs. {(d.revenue || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Patient stats — new vs returning */}
          {(stats.new_patients != null || stats.returning_patients != null) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`rounded-2xl border shadow-sm p-6 ${card}`}>
                <h3 className="font-semibold text-slate-700 dark:text-white mb-4">New vs Returning Patients</h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-blue-600">{stats.new_patients || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">🆕 New</div>
                  </div>
                  <div className={`flex-1 h-4 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <div className="h-4 rounded-l-full bg-blue-500"
                      style={{ width: `${stats.patients_served > 0 ? (stats.new_patients / stats.patients_served) * 100 : 0}%` }} />
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-green-600">{stats.returning_patients || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">🔄 Returning</div>
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl border shadow-sm p-6 ${card}`}>
                <h3 className="font-semibold text-slate-700 dark:text-white mb-4">Avg. Revenue per Invoice</h3>
                <div className="text-4xl font-extrabold text-green-600">
                  Rs. {stats.total_invoices > 0 ? Math.round((stats.total_revenue || 0) / stats.total_invoices).toLocaleString() : '0'}
                </div>
                <div className="text-sm text-slate-500 mt-1">{stats.total_invoices || 0} total invoices in period</div>
                {stats.avg_daily_revenue != null && (
                  <div className="mt-3 text-xs text-slate-400">Avg. daily: Rs. {Math.round(stats.avg_daily_revenue).toLocaleString()}</div>
                )}
              </div>
            </div>
          )}

          {/* Export */}
          <div className={`rounded-2xl border p-4 ${card} print:hidden flex items-center gap-4`}>
            <span className="text-slate-500 text-sm font-medium">Export Report:</span>
            <button onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-medium hover:bg-slate-700">
              🖨️ Print / PDF
            </button>
            <button onClick={() => {
              const rows = [
                ['Metric', 'Value'],
                ['Total Samples', stats.total_samples],
                ['Total Revenue', stats.total_revenue],
                ['Patients Served', stats.patients_served],
                ['Tests Performed', stats.tests_performed],
                ...(stats.test_breakdown || []).map(t => [`Test: ${t.test_panel}`, t.count]),
                ...(stats.payment_breakdown || []).map(p => [`Payment: ${p.method}`, p.total]),
              ]
              const csv = rows.map(r => r.join(',')).join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `mis_report_${fromDate}_${toDate}.csv`
              a.click()
            }} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50">
              📥 Export CSV
            </button>
          </div>

        </div>
      ) : (
        <div className="text-center py-20 text-red-500">Failed to load reports</div>
      )}
    </div>
  )
}
