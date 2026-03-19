import { useState, useEffect } from 'react'
import api from '../api'

const categoryTypes = [
  { key: 'test_category', label: 'Test Categories', desc: 'e.g., Hematology, Biochemistry, Thyroid' },
  { key: 'sample_type', label: 'Sample Types', desc: 'e.g., Blood, Serum, Urine, Stool' },
  { key: 'test_panel', label: 'Test Panels', desc: 'e.g., CBC, LFT, RFT, Lipid Profile' },
  { key: 'specialization', label: 'Doctor Specializations', desc: 'e.g., Pathologist, Cardiologist' },
]

export default function Categories() {
  const [activeTab, setActiveTab] = useState('test_category')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [seeding, setSeeding] = useState(false)

  useEffect(() => { fetchItems() }, [activeTab])

  const fetchItems = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/categories/${activeTab}`)
      setItems(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setError('')
    setSuccess('')
    try {
      await api.post(`/categories/${activeTab}`, { name: newName.trim() })
      setNewName('')
      setSuccess(`"${newName.trim()}" added`)
      fetchItems()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add')
    }
  }

  const handleUpdate = async (id) => {
    if (!editName.trim()) return
    setError('')
    try {
      await api.put(`/categories/${id}`, { name: editName.trim() })
      setEditId(null)
      setEditName('')
      setSuccess('Updated')
      fetchItems()
    } catch (err) {
      setError(err.response?.data?.detail || 'Update failed')
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await api.delete(`/categories/${id}`)
      setSuccess(`"${name}" deleted`)
      fetchItems()
    } catch (err) {
      setError(err.response?.data?.detail || 'Delete failed')
    }
  }

  const handleSeedDefaults = async () => {
    setSeeding(true)
    try {
      const res = await api.post('/categories/seed-defaults')
      setSuccess(res.data.message)
      fetchItems()
    } catch (err) {
      setError(err.response?.data?.detail || 'Seed failed')
    }
    finally { setSeeding(false) }
  }

  const activeType = categoryTypes.find(c => c.key === activeTab)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Categories & Types</h2>
          <p className="text-sm text-slate-500">Manage dropdown options used across the system</p>
        </div>
        <button onClick={handleSeedDefaults} disabled={seeding}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 text-sm disabled:opacity-50">
          {seeding ? 'Loading...' : 'Load Default Values'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg">
        {categoryTypes.map((ct) => (
          <button
            key={ct.key}
            onClick={() => { setActiveTab(ct.key); setError(''); setSuccess('') }}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === ct.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {ct.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-semibold text-slate-700 mb-1">Add New {activeType?.label.replace(/s$/, '')}</h3>
          <p className="text-xs text-slate-400 mb-4">{activeType?.desc}</p>

          <form onSubmit={handleAdd} className="space-y-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Enter name...`}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              required
            />
            <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              Add
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">{activeType?.label} ({items.length})</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                {editId === item.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-3 py-1 border border-blue-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(item.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                    <button onClick={() => handleUpdate(item.id)} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs">Save</button>
                    <button onClick={() => setEditId(null)} className="px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-xs">Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm">{item.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditId(item.id); setEditName(item.name) }}
                        className="text-xs text-blue-600 hover:underline"
                      >Edit</button>
                      <button
                        onClick={() => handleDelete(item.id, item.name)}
                        className="text-xs text-red-600 hover:underline"
                      >Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {!loading && items.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                No items yet. Add one above or click "Load Default Values".
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
