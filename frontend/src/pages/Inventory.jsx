import { useState, useEffect } from 'react'
import api from '../api'
import ModalPortal from '../components/ModalPortal'

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [error, setError] = useState('')
  const [stockModal, setStockModal] = useState(null)
  const [stockQty, setStockQty] = useState('')
  const [stockAction, setStockAction] = useState('add')
  const [form, setForm] = useState({
    name: '', category: 'Consumable', sku: '', quantity: '', min_quantity: '10',
    unit: 'pcs', price_per_unit: '', supplier: '', expiry_date: '', location: '',
  })

  useEffect(() => { fetchItems() }, [filter, lowStockOnly])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter) params.category = filter
      if (lowStockOnly) params.low_stock = true
      const r = await api.get('/inventory', { params })
      setItems(r.data)
    } catch(e) {} finally { setLoading(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('')
    try {
      await api.post('/inventory', { ...form, quantity: parseInt(form.quantity) || 0, min_quantity: parseInt(form.min_quantity) || 10, price_per_unit: parseFloat(form.price_per_unit) || 0 })
      setForm({ name: '', category: 'Consumable', sku: '', quantity: '', min_quantity: '10', unit: 'pcs', price_per_unit: '', supplier: '', expiry_date: '', location: '' })
      setShowForm(false); fetchItems()
    } catch(err) { setError(err.response?.data?.detail || 'Failed') }
  }

  const handleStock = async () => {
    if (!stockQty || !stockModal) return
    try {
      await api.post(`/inventory/${stockModal.id}/stock`, { action: stockAction, quantity: parseInt(stockQty) })
      setStockModal(null); setStockQty(''); fetchItems()
    } catch(err) { alert(err.response?.data?.detail || 'Failed') }
  }

  const lowStockCount = items.filter(i => i.is_low).length
  const expiredCount = items.filter(i => i.is_expired).length
  const totalValue = items.reduce((s, i) => s + i.quantity * i.price_per_unit, 0)

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventory</h2>
          <p className="text-sm text-slate-500">Track reagents, consumables, and equipment</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-stagger">
        <div className="bg-white rounded-2xl shadow-sm border p-4 hover-lift">
          <div className="text-sm text-slate-500">Total Items</div>
          <div className="text-2xl font-bold">{items.length}</div>
        </div>
        <div className={`bg-white rounded-2xl shadow-sm border p-4 hover-lift ${lowStockCount > 0 ? 'border-red-200' : ''}`}>
          <div className="text-sm text-slate-500">Low Stock Alerts</div>
          <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : ''}`}>{lowStockCount}</div>
        </div>
        <div className={`bg-white rounded-2xl shadow-sm border p-4 hover-lift ${expiredCount > 0 ? 'border-orange-200' : ''}`}>
          <div className="text-sm text-slate-500">Expired</div>
          <div className={`text-2xl font-bold ${expiredCount > 0 ? 'text-orange-600' : ''}`}>{expiredCount}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 hover-lift">
          <div className="text-sm text-slate-500">Total Value</div>
          <div className="text-2xl font-bold text-green-700">Rs. {totalValue.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'Reagent', 'Consumable', 'Equipment'].map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs ${filter === c ? 'bg-slate-800 text-white' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}>
            {c || 'All'}
          </button>
        ))}
        <button onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`px-3 py-1.5 rounded-lg text-xs ${lowStockOnly ? 'bg-red-600 text-white' : 'bg-white border text-red-600 hover:bg-red-50'}`}>
          Low Stock Only
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 mb-6 animate-slideDown">
          {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option>Reagent</option><option>Consumable</option><option>Equipment</option>
              </select></div>
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
              <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} min="0" className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Min Qty (alert)</label>
              <input type="number" value={form.min_quantity} onChange={e => setForm({...form, min_quantity: e.target.value})} min="0" className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Unit</label>
              <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option>pcs</option><option>ml</option><option>L</option><option>box</option><option>pack</option><option>roll</option><option>bottle</option>
              </select></div>
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Price/Unit (PKR)</label>
              <input type="number" value={form.price_per_unit} onChange={e => setForm({...form, price_per_unit: e.target.value})} min="0" className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Supplier</label>
              <input value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Expiry Date</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          <button type="submit" className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Add Item</button>
        </form>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Item</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Category</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Stock</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Unit</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Supplier</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Expiry</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(i => (
              <tr key={i.id} className={`hover:bg-slate-50 ${i.is_low ? 'bg-red-50/50' : ''} ${i.is_expired ? 'bg-orange-50/50' : ''}`}>
                <td className="px-4 py-3 font-medium">{i.name}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{i.category}</span></td>
                <td className="px-4 py-3">
                  <span className={`font-bold ${i.is_low ? 'text-red-600' : 'text-slate-800'}`}>{i.quantity}</span>
                  <span className="text-slate-400 text-xs ml-1">/ min {i.min_quantity}</span>
                  {i.is_low && <span className="ml-1 text-xs text-red-500 font-medium">LOW</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{i.unit}</td>
                <td className="px-4 py-3 text-slate-500">{i.supplier || '-'}</td>
                <td className="px-4 py-3">
                  {i.expiry_date ? (
                    <span className={i.is_expired ? 'text-red-600 font-medium' : 'text-slate-500'}>
                      {i.expiry_date} {i.is_expired ? '(EXPIRED)' : ''}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { setStockModal(i); setStockAction('add'); setStockQty('') }}
                    className="text-xs text-blue-600 hover:underline mr-2">+/- Stock</button>
                  <button onClick={async () => { await api.delete(`/inventory/${i.id}`); fetchItems() }}
                    className="text-xs text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stock Modal */}
      {stockModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-scaleIn">
            <h3 className="font-bold text-lg mb-4">Adjust Stock: {stockModal.name}</h3>
            <p className="text-sm text-slate-500 mb-4">Current: {stockModal.quantity} {stockModal.unit}</p>
            <div className="flex gap-2 mb-4">
              {['add', 'use', 'adjust'].map(a => (
                <button key={a} onClick={() => setStockAction(a)}
                  className={`flex-1 py-2 rounded-lg text-sm capitalize ${stockAction === a ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {a}
                </button>
              ))}
            </div>
            <input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} min="0"
              placeholder={stockAction === 'adjust' ? 'Set to quantity' : 'Enter quantity'}
              className="w-full px-4 py-3 border rounded-lg mb-4 outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <button onClick={handleStock} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Confirm</button>
              <button onClick={() => setStockModal(null)} className="flex-1 py-2 bg-slate-200 rounded-lg hover:bg-slate-300">Cancel</button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
