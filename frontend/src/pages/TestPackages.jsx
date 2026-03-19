import { useState, useEffect } from 'react'
import api from '../api'

export default function TestPackages() {
  const [packages, setPackages] = useState([])
  const [tests, setTests] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ name: '', description: '', price: '', tests: [] })

  useEffect(() => {
    fetchPackages()
    api.get('/tests').then(r => setTests(r.data)).catch(() => {})
  }, [])

  const fetchPackages = async () => {
    try { const r = await api.get('/packages'); setPackages(r.data) } catch(e) { console.error(e) }
  }

  const toggleTest = (t) => {
    const exists = form.tests.find(x => x.test_code === t.test_code)
    if (exists) setForm({...form, tests: form.tests.filter(x => x.test_code !== t.test_code)})
    else setForm({...form, tests: [...form.tests, { test_code: t.test_code, test_name: t.test_name, individual_price: t.price || 0 }]})
  }

  const individualTotal = form.tests.reduce((s, t) => s + (t.individual_price || 0), 0)
  const savings = individualTotal - (parseFloat(form.price) || 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    if (form.tests.length < 2) { setError('Select at least 2 tests'); return }
    try {
      await api.post('/packages', { ...form, price: parseFloat(form.price) })
      setSuccess('Package created!')
      setForm({ name: '', description: '', price: '', tests: [] })
      setShowForm(false)
      fetchPackages()
    } catch (err) { setError(err.response?.data?.detail || 'Failed') }
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Test Packages</h2>
          <p className="text-sm text-slate-500">Group tests together at discounted prices</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          {showForm ? 'Cancel' : '+ New Package'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm animate-slideDown">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm animate-slideDown">{success}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6 animate-slideDown">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Package Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                placeholder="e.g., Full Body Checkup"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Package Price (PKR) *</label>
              <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required
                placeholder="Discounted price"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                placeholder="e.g., Includes CBC, LFT, RFT..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <label className="block text-sm font-medium text-slate-700 mb-2">Select Tests ({form.tests.length} selected)</label>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3 mb-4">
            {tests.map(t => {
              const sel = form.tests.find(x => x.test_code === t.test_code)
              return (
                <div key={t.id} onClick={() => toggleTest(t)}
                  className={`p-2 rounded-lg cursor-pointer text-xs transition-all ${sel ? 'bg-blue-100 border-2 border-blue-500 scale-[1.02]' : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'}`}>
                  <div className="font-medium">{t.test_name}</div>
                  <div className="text-slate-500">Rs. {t.price}</div>
                </div>
              )
            })}
          </div>

          {form.tests.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between"><span>Individual Total:</span><span>Rs. {individualTotal}</span></div>
              <div className="flex justify-between"><span>Package Price:</span><span className="font-bold text-green-700">Rs. {form.price || '0'}</span></div>
              {savings > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Patient Saves:</span><span>Rs. {savings}</span></div>}
            </div>
          )}

          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Package</button>
        </form>
      )}

      {/* Package List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger">
        {packages.map(p => (
          <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 card-animate">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-slate-800">{p.name}</h3>
              <button onClick={async () => { await api.delete(`/packages/${p.id}`); fetchPackages() }}
                className="text-xs text-red-500 hover:underline">Delete</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">{p.description}</p>
            <div className="space-y-1 mb-3">
              {p.tests.map(t => (
                <div key={t.test_code} className="flex justify-between text-xs">
                  <span>{t.test_name}</span>
                  <span className="text-slate-400 line-through">Rs. {t.individual_price}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <div>
                <span className="text-xs text-slate-400 line-through">Rs. {p.individual_total}</span>
                <span className="ml-2 text-lg font-bold text-green-700">Rs. {p.price}</span>
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                Save Rs. {p.individual_total - p.price}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
