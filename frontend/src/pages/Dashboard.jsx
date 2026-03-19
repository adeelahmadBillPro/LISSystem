import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDashboard() }, [])

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard')
      setStats(res.data)
    } catch (err) { console.error('Dashboard error:', err) }
    finally { setLoading(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
        </div>
      </div>
    )
  }

  if (!stats) return <div className="text-center py-20 text-red-500 animate-fadeIn">Failed to load dashboard</div>

  const cards = [
    { label: 'Total Patients', value: stats.total_patients, gradient: 'from-blue-500 to-blue-600', icon: '👥' },
    { label: "Today's Samples", value: stats.today_samples, gradient: 'from-emerald-500 to-emerald-600', icon: '🧪' },
    { label: 'Pending Results', value: stats.pending_results, gradient: 'from-amber-500 to-amber-600', icon: '⏳' },
    { label: 'Completed Today', value: stats.completed_today, gradient: 'from-green-500 to-green-600', icon: '✅' },
    { label: 'Critical Alerts', value: stats.critical_alerts, gradient: 'from-red-500 to-red-600', icon: '🚨' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-8 animate-fadeIn">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Welcome back! Here's today's overview.</p>
        </div>
        <div className="text-sm text-slate-400">
          {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8 animate-stagger">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover-lift card-animate overflow-hidden relative">
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${card.gradient} opacity-10 rounded-bl-full`}></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${card.gradient} animate-pulse-soft`}></div>
            </div>
            <div className="text-3xl font-bold text-slate-800 animate-fadeInUp">{card.value}</div>
            <div className="text-xs text-slate-500 mt-1 font-medium">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-stagger">
        <Link to="/patients/new" className="group bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-2xl p-6 transition-all duration-300 hover-lift">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl group-hover:scale-110 transition-transform duration-200">➕</span>
            <h3 className="font-semibold text-slate-800">Register Patient</h3>
          </div>
          <p className="text-sm text-slate-500 group-hover:text-blue-600 transition-colors">Add a new patient to the system</p>
        </Link>
        <Link to="/samples/new" className="group bg-white hover:bg-green-50 border border-slate-200 hover:border-green-300 rounded-2xl p-6 transition-all duration-300 hover-lift">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl group-hover:scale-110 transition-transform duration-200">🧪</span>
            <h3 className="font-semibold text-slate-800">New Sample</h3>
          </div>
          <p className="text-sm text-slate-500 group-hover:text-green-600 transition-colors">Register a new sample for testing</p>
        </Link>
        <Link to="/verification" className="group bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-2xl p-6 transition-all duration-300 hover-lift">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl group-hover:scale-110 transition-transform duration-200">✅</span>
            <h3 className="font-semibold text-slate-800">Verify Results</h3>
          </div>
          <p className="text-sm text-slate-500 group-hover:text-purple-600 transition-colors">Review and approve pending results</p>
        </Link>
      </div>

      {/* Recent Samples Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 animate-fadeInUp overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800">Recent Samples</h3>
          <Link to="/samples" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Sample ID</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Test Panel</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats.recent_samples.map((sample, i) => (
                <tr key={sample.id} className="hover:bg-blue-50/30 transition-colors duration-150"
                    style={{animation: `fadeIn 0.3s ease-out ${i * 0.05}s forwards`, opacity: 0}}>
                  <td className="px-6 py-4 font-semibold text-slate-800">{sample.sample_id}</td>
                  <td className="px-6 py-4 text-slate-600">{sample.test_panel || '-'}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={sample.status} />
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {new Date(sample.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 space-x-3">
                    <Link to={`/results/${sample.sample_id}`} className="text-blue-600 hover:text-blue-800 font-medium text-xs transition-colors">
                      Results
                    </Link>
                    <Link to={`/report/${sample.sample_id}`} className="text-emerald-600 hover:text-emerald-800 font-medium text-xs transition-colors">
                      Report
                    </Link>
                  </td>
                </tr>
              ))}
              {stats.recent_samples.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    <div className="text-3xl mb-2">🧪</div>
                    No samples yet. Register a sample to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    processing: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    printed: 'bg-slate-50 text-slate-600 border-slate-200',
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.pending} transition-all duration-200`}>
      {status}
    </span>
  )
}
