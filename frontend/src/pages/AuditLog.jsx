import { useState, useEffect } from 'react'
import api from '../api'

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => { fetchLogs() }, [filter])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter) params.action = filter
      const res = await api.get('/audit-logs', { params })
      setLogs(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const actions = ['', 'LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'VERIFY', 'WHATSAPP', 'EMAIL', 'PRINT']
  const actionColors = {
    LOGIN: 'bg-blue-600 text-white', CREATE: 'bg-green-600 text-white',
    UPDATE: 'bg-amber-500 text-white', DELETE: 'bg-red-600 text-white',
    VERIFY: 'bg-emerald-600 text-white', WHATSAPP: 'bg-green-700 text-white',
    EMAIL: 'bg-purple-600 text-white', PRINT: 'bg-slate-600 text-white',
    MANUAL_ENTRY: 'bg-indigo-600 text-white', SMS: 'bg-teal-600 text-white',
    STATUS_UPDATE: 'bg-cyan-600 text-white',
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Audit Log</h2>

      <div className="flex gap-2 mb-4">
        {actions.map((a) => (
          <button key={a} onClick={() => setFilter(a)}
            className={`px-3 py-1.5 rounded-lg text-xs ${filter === a ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {a || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Time</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">User</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Action</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Entity</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-medium">{l.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[l.action] || 'bg-slate-100'}`}>
                    {l.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{l.entity_type} {l.entity_id ? `#${l.entity_id}` : ''}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{l.details || '-'}</td>
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">No audit logs yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
