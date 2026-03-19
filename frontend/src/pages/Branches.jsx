import { useState, useEffect } from 'react'
import api from '../api'

export default function Branches() {
  const [branches, setBranches] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '' })

  useEffect(() => { fetchBranches() }, [])

  const fetchBranches = async () => {
    try { const r = await api.get('/branches'); setBranches(r.data) } catch(e) { console.error(e) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('')
    try {
      await api.post('/branches', form)
      setForm({ name: '', code: '', address: '', phone: '' })
      setShowForm(false)
      fetchBranches()
    } catch (err) { setError(err.response?.data?.detail || 'Failed') }
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Branches</h2>
          <p className="text-sm text-slate-500">Manage multi-branch lab locations</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          {showForm ? 'Cancel' : '+ Add Branch'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 mb-6 animate-slideDown">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Branch Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                placeholder="e.g., Gulberg Branch"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Branch Code *</label>
              <input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} required
                placeholder="e.g., GBR" maxLength={10}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <button type="submit" className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger">
        {branches.map(b => (
          <div key={b.id} className="bg-white rounded-2xl shadow-sm border p-5 card-animate">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-800">{b.name}</h3>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-mono">{b.code}</span>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {b.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-2">{b.address || 'No address'}</p>
            <p className="text-sm text-slate-500">{b.phone || 'No phone'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
