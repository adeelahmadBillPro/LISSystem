import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'
import ModalPortal from '../components/ModalPortal'

const CATEGORIES = ['Tablet', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Capsule', 'Powder', 'Suppository', 'Patch']
const UNITS = ['tablet', 'ml', 'vial', 'strip', 'bottle', 'tube', 'sachet', 'capsule']

export default function PharmacyStore() {
  const [tab, setTab] = useState('dispense')
  const [meds, setMeds]           = useState([])
  const [dispenses, setDispenses] = useState([])
  const [stats, setStats]         = useState({})
  const [patients, setPatients]   = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [rxLoading, setRxLoading] = useState(false)
  const [search, setSearch]       = useState('')
  const [medSearch, setMedSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showMedModal, setShowMedModal]   = useState(false)
  const [showDispModal, setShowDispModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [editMed, setEditMed]     = useState(null)
  const [stockMed, setStockMed]   = useState(null)
  const [stockAdj, setStockAdj]   = useState({ qty: '', reason: '' })
  const [lastDispense, setLastDispense] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [dispTab, setDispTab]     = useState('manual')
  const [rxSearch, setRxSearch]   = useState('')
  const [selectedRx, setSelectedRx] = useState(null)
  const [rxMedMatches, setRxMedMatches] = useState({})
  const receiptRef = useRef(null)

  const [medForm, setMedForm] = useState({
    name: '', generic_name: '', category: 'Tablet', manufacturer: '',
    unit: 'tablet', price: 0, stock_quantity: 0, reorder_level: 10, expiry_date: '',
  })
  const [dispForm, setDispForm] = useState({
    patient_id: '', prescription_id: null, discount: 0, notes: '', items: [],
  })
  const [dispMedSearch, setDispMedSearch] = useState('')
  const [dispMedResults, setDispMedResults] = useState([])

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadMeds = useCallback(async () => {
    try {
      const r = await api.get('/pharmacy/medications', { params: { search: medSearch || undefined, category: catFilter || undefined } })
      setMeds(r.data)
    } catch {}
  }, [medSearch, catFilter])

  const loadDispenses = useCallback(async () => {
    try {
      const r = await api.get('/pharmacy/dispenses', { params: { search: search || undefined } })
      setDispenses(r.data)
    } catch {}
  }, [search])

  const loadStats = async () => {
    try {
      const r = await api.get('/pharmacy/stats')
      setStats(r.data)
    } catch {}
  }

  const loadPrescriptions = useCallback(async () => {
    setRxLoading(true)
    try {
      const r = await api.get('/prescriptions', { params: { limit: 100 } })
      setPrescriptions(r.data)
    } catch {}
    setRxLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadMeds(), loadDispenses(), loadStats()]).finally(() => setLoading(false))
  }, [loadMeds, loadDispenses])

  useEffect(() => {
    if (tab === 'prescription') loadPrescriptions()
  }, [tab, loadPrescriptions])

  // ── Patient / Med search ─────────────────────────────────────────────────
  const searchPatients = async (q) => {
    if (q.length < 2) { setPatients([]); return }
    try {
      const r = await api.get('/patients', { params: { search: q, limit: 10 } })
      setPatients(r.data)
    } catch {}
  }

  const searchDispMeds = async (q) => {
    if (q.length < 1) { setDispMedResults([]); return }
    try {
      const r = await api.get('/pharmacy/medications', { params: { search: q, limit: 10 } })
      setDispMedResults(r.data)
    } catch {}
  }

  // ── Medicine CRUD ────────────────────────────────────────────────────────
  const openNewMed = () => {
    setEditMed(null)
    setMedForm({ name: '', generic_name: '', category: 'Tablet', manufacturer: '', unit: 'tablet', price: 0, stock_quantity: 0, reorder_level: 10, expiry_date: '' })
    setShowMedModal(true)
  }

  const openEditMed = (m) => {
    setEditMed(m)
    setMedForm({ name: m.name, generic_name: m.generic_name || '', category: m.category || 'Tablet', manufacturer: m.manufacturer || '', unit: m.unit, price: m.price, stock_quantity: m.stock_quantity, reorder_level: m.reorder_level, expiry_date: m.expiry_date || '' })
    setShowMedModal(true)
  }

  const handleSaveMed = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editMed) {
        await api.put(`/pharmacy/medications/${editMed.id}`, medForm)
      } else {
        await api.post('/pharmacy/medications', medForm)
      }
      setShowMedModal(false)
      loadMeds()
      loadStats()
    } catch (err) { alert(err.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  const handleDeleteMed = async (m) => {
    if (!confirm(`Remove "${m.name}" from pharmacy?`)) return
    try {
      await api.delete(`/pharmacy/medications/${m.id}`)
      loadMeds()
      loadStats()
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed') }
  }

  // ── Stock Adjustment Modal ───────────────────────────────────────────────
  const openStockAdjust = (m) => {
    setStockMed(m)
    setStockAdj({ qty: '', reason: '' })
    setShowStockModal(true)
  }

  const handleStockAdjust = async (e) => {
    e.preventDefault()
    const adj = parseInt(stockAdj.qty)
    if (isNaN(adj) || adj === 0) { alert('Enter a non-zero quantity'); return }
    try {
      await api.put(`/pharmacy/medications/${stockMed.id}/stock`, { adjustment: adj, reason: stockAdj.reason })
      setShowStockModal(false)
      loadMeds()
      loadStats()
    } catch (err) { alert(err.response?.data?.detail || 'Stock update failed') }
  }

  // quick +/- single unit from inventory table
  const quickStockStep = async (m, delta) => {
    try {
      await api.put(`/pharmacy/medications/${m.id}/stock`, { adjustment: delta })
      loadMeds()
    } catch (err) { alert(err.response?.data?.detail || 'Stock update failed') }
  }

  // ── Dispense items helpers ───────────────────────────────────────────────
  const addDispItem = (med) => {
    if (dispForm.items.find(i => i.medication_id === med.id)) {
      setDispMedSearch('')
      setDispMedResults([])
      return
    }
    setDispForm(f => ({
      ...f,
      items: [...f.items, { medication_id: med.id, name: med.name, unit: med.unit, quantity: 1, unit_price: med.price, subtotal: med.price }]
    }))
    setDispMedSearch('')
    setDispMedResults([])
  }

  const updateDispItem = (idx, field, value) => {
    setDispForm(f => {
      const items = [...f.items]
      items[idx] = { ...items[idx], [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        const qty   = field === 'quantity'   ? Number(value) : Number(items[idx].quantity)
        const price = field === 'unit_price' ? Number(value) : Number(items[idx].unit_price)
        items[idx].subtotal = (qty * price).toFixed(2)
      }
      return { ...f, items }
    })
  }

  const removeDispItem = (idx) => {
    setDispForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  const totalAmount = () => {
    const sub = dispForm.items.reduce((s, i) => s + Number(i.subtotal), 0)
    return Math.max(0, sub - Number(dispForm.discount || 0))
  }

  // ── From Prescription: select & auto-fill ────────────────────────────────
  const filteredRx = prescriptions.filter(rx => {
    const q = rxSearch.toLowerCase()
    return !q || rx.patient_name?.toLowerCase().includes(q) || rx.patient_mrn?.toLowerCase().includes(q) || rx.doctor_name?.toLowerCase().includes(q)
  })

  const loadRxMedMatches = async (rx) => {
    // Try to match each prescribed medicine name to a pharmacy medication
    const matches = {}
    for (const item of rx.items) {
      try {
        const r = await api.get('/pharmacy/medications', { params: { search: item.medicine_name, limit: 5 } })
        matches[item.id] = r.data
      } catch {}
    }
    setRxMedMatches(matches)
  }

  const selectPrescription = async (rx) => {
    setSelectedRx(rx)
    await loadRxMedMatches(rx)
  }

  const buildDispenseFromRx = () => {
    if (!selectedRx) return
    const items = []
    for (const rxItem of selectedRx.items) {
      const candidates = rxMedMatches[rxItem.id] || []
      if (candidates.length > 0) {
        const med = candidates[0]
        items.push({
          medication_id: med.id,
          name: med.name,
          unit: med.unit,
          quantity: 1,
          unit_price: med.price,
          subtotal: med.price,
        })
      }
    }
    setDispForm(f => ({
      ...f,
      patient_id: selectedRx.patient_id,
      prescription_id: selectedRx.id,
      items,
    }))
    setPatientSearch(selectedRx.patient_name)
    setDispTab('manual')
    setSelectedRx(null)
    setRxMedMatches({})
    setShowDispModal(true)
  }

  // ── Dispense submit ──────────────────────────────────────────────────────
  const handleDispense = async (e) => {
    e.preventDefault()
    if (dispForm.items.length === 0) { alert('Add at least one medication'); return }
    setSaving(true)
    try {
      const payload = {
        patient_id: dispForm.patient_id || null,
        prescription_id: dispForm.prescription_id || null,
        discount: Number(dispForm.discount) || 0,
        notes: dispForm.notes,
        items: dispForm.items.map(i => ({
          medication_id: i.medication_id,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
        })),
      }
      const res = await api.post('/pharmacy/dispenses', payload)
      // Build receipt data
      setLastDispense({
        dispense_number: res.data.dispense_number,
        patient_name: patientSearch || 'Walk-in',
        total_amount: res.data.total_amount,
        discount: Number(dispForm.discount) || 0,
        notes: dispForm.notes,
        dispensed_at: new Date().toLocaleString('en-PK'),
        items: dispForm.items,
      })
      setShowDispModal(false)
      setDispForm({ patient_id: '', prescription_id: null, discount: 0, notes: '', items: [] })
      setPatientSearch('')
      loadDispenses()
      loadMeds()
      loadStats()
      setShowReceiptModal(true)
    } catch (err) { alert(err.response?.data?.detail || 'Dispense failed') }
    setSaving(false)
  }

  const handleDeleteDispense = async (id) => {
    if (!confirm('Reverse this dispense? Stock will be restored.')) return
    try {
      await api.delete(`/pharmacy/dispenses/${id}`)
      loadDispenses()
      loadMeds()
      loadStats()
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed') }
  }

  // ── Print receipt ────────────────────────────────────────────────────────
  const handlePrint = () => {
    const printContent = receiptRef.current?.innerHTML
    if (!printContent) return
    const win = window.open('', '_blank', 'width=400,height=600')
    win.document.write(`
      <html><head><title>Pharmacy Receipt</title>
      <style>
        body { font-family: monospace; font-size: 12px; margin: 16px; }
        h2 { text-align: center; margin: 0 0 4px; }
        p { margin: 2px 0; text-align: center; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 3px 4px; }
        th { text-align: left; border-bottom: 1px solid #000; }
        .right { text-align: right; }
        .total { font-weight: bold; font-size: 13px; }
        @media print { body { margin: 0; } }
      </style>
      </head><body>${printContent}</body></html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fadeIn space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Pharmacy</h2>
          <p className="text-sm text-slate-500 mt-0.5">Medicine inventory and patient dispensing</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openNewMed} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm hover:bg-slate-200">
            ➕ Add Medicine
          </button>
          <button
            onClick={() => {
              setDispForm({ patient_id: '', prescription_id: null, discount: 0, notes: '', items: [] })
              setPatientSearch('')
              setDispTab('manual')
              setShowDispModal(true)
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
            💊 Dispense
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Medicines', value: stats.total_medications || 0, icon: '💊', color: 'bg-blue-50 border-blue-200' },
          { label: 'Low Stock Alert', value: stats.low_stock_count || 0, icon: '⚠️', color: 'bg-red-50 border-red-200' },
          { label: "Today's Dispenses", value: stats.today_dispenses || 0, icon: '📦', color: 'bg-green-50 border-green-200' },
          { label: "Today's Revenue", value: `Rs. ${(stats.today_revenue || 0).toLocaleString()}`, icon: '💰', color: 'bg-yellow-50 border-yellow-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-3 sm:p-4 ${s.color}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-800">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
        {[
          ['dispense', '📦 Dispenses'],
          ['inventory', '💊 Medicines'],
          ['prescription', '📋 From Prescription'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Medicines Tab ── */}
      {tab === 'inventory' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-wrap gap-3">
            <input placeholder="Search medicine..." value={medSearch} onChange={e => setMedSearch(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[140px]" />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none">
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-800 text-white text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Medicine</th>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-left px-4 py-3">Unit</th>
                    <th className="text-left px-4 py-3">Price</th>
                    <th className="text-left px-4 py-3">Stock</th>
                    <th className="text-left px-4 py-3">Expiry</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {meds.map(m => (
                    <tr key={m.id} className={`hover:bg-slate-50 ${m.low_stock ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{m.name}</div>
                        {m.generic_name && <div className="text-xs text-slate-400">{m.generic_name}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{m.category}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{m.unit}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">Rs. {Number(m.price).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => quickStockStep(m, -1)} disabled={m.stock_quantity === 0}
                            className="w-6 h-6 rounded bg-red-100 text-red-700 text-xs font-bold disabled:opacity-30 hover:bg-red-200">−</button>
                          <span className={`font-bold text-sm min-w-[30px] text-center ${m.low_stock ? 'text-red-600' : 'text-slate-700'}`}>
                            {m.stock_quantity}
                          </span>
                          <button onClick={() => quickStockStep(m, 1)}
                            className="w-6 h-6 rounded bg-green-100 text-green-700 text-xs font-bold hover:bg-green-200">+</button>
                          {m.low_stock && <span className="text-[10px] text-red-600 font-medium">LOW</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.expiry_date || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          <button onClick={() => openStockAdjust(m)}
                            className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">Stock</button>
                          <button onClick={() => openEditMed(m)}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">Edit</button>
                          <button onClick={() => handleDeleteMed(m)}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {meds.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No medicines found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Dispenses Tab ── */}
      {tab === 'dispense' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-slate-100">
            <input placeholder="Search patient..." value={search} onChange={e => setSearch(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-slate-800 text-white text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Dispense #</th>
                  <th className="text-left px-4 py-3">Patient</th>
                  <th className="text-left px-4 py-3">Items</th>
                  <th className="text-left px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dispenses.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.dispense_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{d.patient_name}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-600 space-y-0.5">
                        {d.items.slice(0, 2).map(i => <div key={i.id}>{i.medication_name} × {i.quantity}</div>)}
                        {d.items.length > 2 && <div className="text-slate-400">+{d.items.length - 2} more</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">Rs. {Number(d.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {d.dispensed_at ? new Date(d.dispensed_at).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDeleteDispense(d.id)}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Reverse</button>
                    </td>
                  </tr>
                ))}
                {dispenses.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No dispenses found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── From Prescription Tab ── */}
      {tab === 'prescription' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
            <input
              placeholder="Search by patient name, MRN or doctor..."
              value={rxSearch} onChange={e => setRxSearch(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]" />
            <button onClick={loadPrescriptions} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">🔄 Refresh</button>
          </div>
          {rxLoading ? (
            <div className="p-8 text-center text-slate-400">Loading prescriptions...</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredRx.length === 0 && (
                <div className="p-10 text-center text-slate-400">
                  <div className="text-3xl mb-2">📋</div>
                  <p>No prescriptions found</p>
                </div>
              )}
              {filteredRx.map(rx => (
                <div key={rx.id} className={`p-4 hover:bg-slate-50 transition-colors ${selectedRx?.id === rx.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">{rx.patient_name}</span>
                        {rx.patient_mrn && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">{rx.patient_mrn}</span>}
                        {rx.doctor_name && <span className="text-xs text-slate-500">Dr. {rx.doctor_name}</span>}
                        <span className="text-xs text-slate-400">{rx.created_at ? new Date(rx.created_at).toLocaleDateString('en-PK') : ''}</span>
                      </div>
                      {rx.diagnosis && <div className="text-xs text-slate-500 mb-2">Dx: {rx.diagnosis}</div>}
                      <div className="flex flex-wrap gap-1.5">
                        {rx.items.map(item => (
                          <div key={item.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100">
                            <span className="font-medium">{item.medicine_name}</span>
                            {item.dosage && <span className="text-blue-500"> · {item.dosage}</span>}
                            {item.frequency && <span className="text-blue-400"> · {item.frequency}</span>}
                          </div>
                        ))}
                        {rx.items.length === 0 && <span className="text-xs text-slate-400 italic">No medicines prescribed</span>}
                      </div>
                      {/* Med matches preview when selected */}
                      {selectedRx?.id === rx.id && rx.items.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <div className="text-xs font-semibold text-slate-600 mb-1">Pharmacy matches:</div>
                          {rx.items.map(item => {
                            const matches = rxMedMatches[item.id] || []
                            return (
                              <div key={item.id} className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-slate-600 min-w-[120px]">{item.medicine_name}</span>
                                <span className="text-slate-400">→</span>
                                {matches.length > 0
                                  ? <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded">{matches[0].name} (Stock: {matches[0].stock_quantity}, Rs. {matches[0].price})</span>
                                  : <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded">Not found in pharmacy</span>
                                }
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {selectedRx?.id === rx.id ? (
                        <>
                          <button onClick={buildDispenseFromRx}
                            disabled={rx.items.length === 0}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                            💊 Dispense
                          </button>
                          <button onClick={() => { setSelectedRx(null); setRxMedMatches({}) }}
                            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs hover:bg-slate-200">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button onClick={() => selectPrescription(rx)}
                          disabled={rx.items.length === 0}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                          Select
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Medicine Modal ── */}
      {showMedModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editMed ? 'Edit Medicine' : 'Add Medicine'}</h3>
              <button onClick={() => setShowMedModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSaveMed} className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Brand Name *</label>
                  <input value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} required
                    placeholder="e.g. Augmentin"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Generic Name</label>
                  <input value={medForm.generic_name} onChange={e => setMedForm(f => ({ ...f, generic_name: e.target.value }))}
                    placeholder="e.g. Amoxicillin"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select value={medForm.category} onChange={e => setMedForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                  <select value={medForm.unit} onChange={e => setMedForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price (Rs.)</label>
                  <input type="number" value={medForm.price} onChange={e => setMedForm(f => ({ ...f, price: e.target.value }))} min="0" step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock</label>
                  <input type="number" value={medForm.stock_quantity} onChange={e => setMedForm(f => ({ ...f, stock_quantity: e.target.value }))} min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reorder At</label>
                  <input type="number" value={medForm.reorder_level} onChange={e => setMedForm(f => ({ ...f, reorder_level: e.target.value }))} min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer</label>
                  <input value={medForm.manufacturer} onChange={e => setMedForm(f => ({ ...f, manufacturer: e.target.value }))}
                    placeholder="e.g. GSK, Abbott"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                  <input type="date" value={medForm.expiry_date} onChange={e => setMedForm(f => ({ ...f, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : editMed ? 'Update Medicine' : 'Add Medicine'}
                </button>
                <button type="button" onClick={() => setShowMedModal(false)}
                  className="px-5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Stock Adjustment Modal ── */}
      {showStockModal && stockMed && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Stock Adjustment</h3>
                <p className="text-xs text-slate-500 mt-0.5">{stockMed.name} — Current: {stockMed.stock_quantity} {stockMed.unit}s</p>
              </div>
              <button onClick={() => setShowStockModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleStockAdjust} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity Change</label>
                <div className="flex gap-2 mb-1">
                  <button type="button" onClick={() => setStockAdj(a => ({ ...a, qty: a.qty.startsWith('-') ? a.qty.slice(1) : `-${a.qty || ''}` }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-slate-100">
                    +/−
                  </button>
                  <input type="number" value={stockAdj.qty} onChange={e => setStockAdj(a => ({ ...a, qty: e.target.value }))}
                    placeholder="e.g. 50 or -10" required
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <p className="text-xs text-slate-400">Use positive to add stock, negative to remove</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason (optional)</label>
                <input value={stockAdj.reason} onChange={e => setStockAdj(a => ({ ...a, reason: e.target.value }))}
                  placeholder="e.g. Purchase received, Damage write-off"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {stockAdj.qty && !isNaN(parseInt(stockAdj.qty)) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  New stock: <span className="font-bold text-blue-700">{Math.max(0, stockMed.stock_quantity + parseInt(stockAdj.qty))} {stockMed.unit}s</span>
                </div>
              )}
              <div className="flex gap-3">
                <button type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
                  Update Stock
                </button>
                <button type="button" onClick={() => setShowStockModal(false)}
                  className="px-5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Dispense Modal ── */}
      {showDispModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[93vh] flex flex-col">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-slate-800">💊 Dispense Medicines</h3>
              <button onClick={() => setShowDispModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {/* Sub-tabs inside dispense modal */}
            <div className="px-4 sm:px-5 pt-3 flex gap-1 bg-slate-50 border-b flex-shrink-0">
              {[['manual', 'Manual Entry'], ['from_rx', 'From Prescription']].map(([k, label]) => (
                <button key={k} onClick={() => setDispTab(k)}
                  className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-all ${dispTab === k ? 'bg-white text-blue-700 border border-b-white border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 p-4 sm:p-5">
              {dispTab === 'manual' ? (
                <form id="dispForm" onSubmit={handleDispense} className="space-y-4">
                  {/* Patient (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Patient (optional)</label>
                    <div className="relative">
                      <input value={patientSearch} onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value) }}
                        placeholder="Search patient or leave blank for walk-in"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      {patients.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-36 overflow-y-auto">
                          {patients.map(p => (
                            <div key={p.id}
                              onClick={() => { setDispForm(f => ({ ...f, patient_id: p.id })); setPatientSearch(`${p.first_name} ${p.last_name}`); setPatients([]) }}
                              className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0">
                              {p.first_name} {p.last_name} — {p.phone}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {dispForm.prescription_id && (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                      <span>📋</span>
                      <span>Linked to prescription #{dispForm.prescription_id}</span>
                      <button type="button" onClick={() => setDispForm(f => ({ ...f, prescription_id: null }))} className="ml-auto text-blue-400 hover:text-blue-600">✕</button>
                    </div>
                  )}

                  {/* Medicine search */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Add Medicines *</label>
                    <div className="relative">
                      <input value={dispMedSearch} onChange={e => { setDispMedSearch(e.target.value); searchDispMeds(e.target.value) }}
                        placeholder="Type medicine name to search..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      {dispMedResults.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {dispMedResults.map(m => (
                            <div key={m.id} onClick={() => m.stock_quantity > 0 && addDispItem(m)}
                              className={`px-3 py-2 text-sm flex justify-between border-b border-slate-50 last:border-0 ${m.stock_quantity === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50 cursor-pointer'}`}>
                              <span>{m.name} <span className="text-slate-400 text-xs">({m.generic_name})</span></span>
                              <span className="text-xs text-slate-500">Stock: {m.stock_quantity} · Rs. {m.price}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items table */}
                  {dispForm.items.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[400px]">
                          <thead className="bg-slate-50 text-xs text-slate-600">
                            <tr>
                              <th className="text-left px-3 py-2">Medicine</th>
                              <th className="text-center px-3 py-2">Qty</th>
                              <th className="text-center px-3 py-2">Price</th>
                              <th className="text-center px-3 py-2">Total</th>
                              <th className="px-3 py-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dispForm.items.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2">{item.name} <span className="text-slate-400 text-xs">({item.unit})</span></td>
                                <td className="px-3 py-2">
                                  <input type="number" value={item.quantity} min="1"
                                    onChange={e => updateDispItem(idx, 'quantity', e.target.value)}
                                    className="w-14 text-center border border-slate-200 rounded px-1 py-0.5 text-sm" />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" value={item.unit_price} min="0" step="0.01"
                                    onChange={e => updateDispItem(idx, 'unit_price', e.target.value)}
                                    className="w-20 text-center border border-slate-200 rounded px-1 py-0.5 text-sm" />
                                </td>
                                <td className="px-3 py-2 text-center font-medium">Rs. {Number(item.subtotal).toFixed(0)}</td>
                                <td className="px-3 py-2">
                                  <button type="button" onClick={() => removeDispItem(idx)} className="text-red-500 hover:text-red-700">✕</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Discount (Rs.)</label>
                      <input type="number" value={dispForm.discount}
                        onChange={e => setDispForm(f => ({ ...f, discount: e.target.value }))} min="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Total Payable</div>
                        <div className="text-2xl font-bold text-green-700">Rs. {totalAmount().toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <input value={dispForm.notes} onChange={e => setDispForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Optional notes"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </form>
              ) : (
                /* From Prescription sub-tab inside dispense modal */
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">Select a prescription to auto-fill the dispense form.</p>
                  <input placeholder="Search patient or MRN..."
                    value={rxSearch} onChange={e => setRxSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  {rxLoading ? (
                    <div className="py-6 text-center text-slate-400 text-sm">Loading...</div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      {filteredRx.length === 0 && (
                        <div className="p-6 text-center text-slate-400 text-sm">No prescriptions found</div>
                      )}
                      {filteredRx.map(rx => (
                        <button key={rx.id} type="button"
                          onClick={() => {
                            setDispForm(f => ({
                              ...f,
                              patient_id: rx.patient_id,
                              prescription_id: rx.id,
                            }))
                            setPatientSearch(rx.patient_name)
                            setDispTab('manual')
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-medium text-sm text-slate-800">{rx.patient_name}</span>
                              {rx.patient_mrn && <span className="ml-2 text-xs text-slate-400 font-mono">{rx.patient_mrn}</span>}
                              {rx.doctor_name && <span className="ml-2 text-xs text-slate-500">Dr. {rx.doctor_name}</span>}
                            </div>
                            <span className="text-xs text-slate-400">{rx.created_at ? new Date(rx.created_at).toLocaleDateString('en-PK') : ''}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {rx.items.slice(0, 3).map(i => (
                              <span key={i.id} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{i.medicine_name}</span>
                            ))}
                            {rx.items.length > 3 && <span className="text-xs text-slate-400">+{rx.items.length - 3} more</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 sm:px-5 py-3 sm:py-4 border-t flex gap-3 flex-shrink-0">
              {dispTab === 'manual' ? (
                <>
                  <button form="dispForm" type="submit" disabled={saving || dispForm.items.length === 0}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 text-sm">
                    {saving ? 'Processing...' : `💊 Dispense — Rs. ${totalAmount().toLocaleString()}`}
                  </button>
                  <button type="button" onClick={() => setShowDispModal(false)}
                    className="px-4 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm">Cancel</button>
                </>
              ) : (
                <button type="button" onClick={() => setShowDispModal(false)}
                  className="px-6 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm">Close</button>
              )}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Receipt Modal ── */}
      {showReceiptModal && lastDispense && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Dispense Receipt</h3>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {/* Printable receipt content */}
            <div ref={receiptRef} className="p-4">
              <h2 style={{ textAlign: 'center', marginBottom: 2 }}>PHARMACY RECEIPT</h2>
              <p style={{ textAlign: 'center', margin: '2px 0' }}>{lastDispense.dispense_number}</p>
              <p style={{ textAlign: 'center', margin: '2px 0', fontSize: 12 }}>{lastDispense.dispensed_at}</p>
              <hr style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />
              <p style={{ margin: '2px 0' }}><strong>Patient:</strong> {lastDispense.patient_name}</p>
              <hr style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '3px 4px', borderBottom: '1px solid #000' }}>Medicine</th>
                    <th style={{ textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #000' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #000' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #000' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lastDispense.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '3px 4px' }}>{item.name}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px' }}>Rs.{Number(item.unit_price).toFixed(0)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px' }}>Rs.{Number(item.subtotal).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <hr style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />
              {Number(lastDispense.discount) > 0 && (
                <p style={{ textAlign: 'right', margin: '2px 0', fontSize: 12 }}>Discount: Rs.{Number(lastDispense.discount).toFixed(0)}</p>
              )}
              <p style={{ textAlign: 'right', margin: '4px 0', fontWeight: 'bold', fontSize: 14 }}>
                TOTAL: Rs.{Number(lastDispense.total_amount).toFixed(0)}
              </p>
              {lastDispense.notes && (
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#555' }}>Note: {lastDispense.notes}</p>
              )}
              <p style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#888' }}>Thank you — Get well soon!</p>
            </div>

            <div className="px-4 pb-4 flex gap-2">
              <button onClick={handlePrint}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 text-sm">
                🖨️ Print Receipt
              </button>
              <button onClick={() => setShowReceiptModal(false)}
                className="px-4 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm">Close</button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
