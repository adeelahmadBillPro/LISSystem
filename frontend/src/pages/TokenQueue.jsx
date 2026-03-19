import { useState, useEffect } from 'react'
import api from '../api'

export default function TokenQueue() {
  const [tokens, setTokens] = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ patient_name: '', phone: '', counter: 'Counter 1', notes: '' })

  useEffect(() => {
    fetchTokens()
    fetchCurrent()
    const interval = setInterval(() => { fetchTokens(); fetchCurrent() }, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchTokens = async () => {
    try { const r = await api.get('/tokens'); setTokens(r.data) } catch(e) {}
    finally { setLoading(false) }
  }

  const fetchCurrent = async () => {
    try { const r = await api.get('/tokens/current'); setCurrent(r.data) } catch(e) {}
  }

  const createToken = async (e) => {
    e.preventDefault()
    try {
      const r = await api.post('/tokens', form)
      setForm({ patient_name: '', phone: '', counter: 'Counter 1', notes: '' })
      setShowForm(false)
      fetchTokens(); fetchCurrent()
    } catch(e) { alert(e.response?.data?.detail || 'Failed') }
  }

  const callToken = async (id) => { await api.put(`/tokens/${id}/call`); fetchTokens(); fetchCurrent() }
  const completeToken = async (id) => { await api.put(`/tokens/${id}/complete`); fetchTokens(); fetchCurrent() }
  const cancelToken = async (id) => { await api.put(`/tokens/${id}/cancel`); fetchTokens(); fetchCurrent() }

  const waiting = tokens.filter(t => t.status === 'waiting')
  const inProgress = tokens.filter(t => t.status === 'in_progress')
  const completed = tokens.filter(t => t.status === 'completed')

  const statusColors = { waiting: 'bg-yellow-100 text-yellow-700', in_progress: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Token Queue</h2>
          <p className="text-sm text-slate-500">Manage walk-in patient queue</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          {showForm ? 'Cancel' : '+ New Token'}
        </button>
      </div>

      {/* Current Token Display */}
      {current && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white animate-fadeInUp">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Now Serving</p>
              <p className="text-5xl font-bold mt-1">{current.current_token || '-'}</p>
              <p className="text-blue-200 mt-1">{current.current_counter} {current.current_patient ? `• ${current.current_patient}` : ''}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{current.waiting_count}</div>
              <p className="text-blue-200 text-sm">Waiting</p>
              <div className="text-lg mt-2">{current.total_today} total today</div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={createToken} className="bg-white rounded-2xl shadow-sm border p-6 mb-6 animate-slideDown">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Patient Name</label>
              <input value={form.patient_name} onChange={e => setForm({...form, patient_name: e.target.value})}
                placeholder="Walk-in patient" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                placeholder="Optional" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Counter</label>
              <select value={form.counter} onChange={e => setForm({...form, counter: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                <option>Counter 1</option><option>Counter 2</option><option>Blood Draw</option><option>Report Collection</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Generate Token
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Waiting */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-yellow-50"><h3 className="font-semibold text-yellow-800">Waiting ({waiting.length})</h3></div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {waiting.map(t => (
              <div key={t.id} className="p-3 hover:bg-slate-50 flex justify-between items-center">
                <div>
                  <span className="text-2xl font-bold text-slate-800 mr-3">{t.token_number}</span>
                  <span className="text-sm text-slate-500">{t.patient_name || 'Walk-in'}</span>
                </div>
                <button onClick={() => callToken(t.id)} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                  Call
                </button>
              </div>
            ))}
            {waiting.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">No one waiting</div>}
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-blue-50"><h3 className="font-semibold text-blue-800">In Progress ({inProgress.length})</h3></div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {inProgress.map(t => (
              <div key={t.id} className="p-3 hover:bg-slate-50">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-2xl font-bold text-blue-700 mr-3">{t.token_number}</span>
                    <span className="text-sm text-slate-500">{t.patient_name || 'Walk-in'}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => completeToken(t.id)} className="px-3 py-1 bg-green-600 text-white rounded text-xs">Done</button>
                    <button onClick={() => cancelToken(t.id)} className="px-3 py-1 bg-red-100 text-red-600 rounded text-xs">Cancel</button>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-1">{t.counter}</div>
              </div>
            ))}
            {inProgress.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">None in progress</div>}
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-green-50"><h3 className="font-semibold text-green-800">Completed ({completed.length})</h3></div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {completed.map(t => (
              <div key={t.id} className="p-3 text-slate-400">
                <span className="text-lg font-bold mr-3">{t.token_number}</span>
                <span className="text-sm">{t.patient_name || 'Walk-in'}</span>
              </div>
            ))}
            {completed.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">None completed yet</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
