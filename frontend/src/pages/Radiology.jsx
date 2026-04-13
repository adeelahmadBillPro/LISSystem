import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'
import ModalPortal from '../components/ModalPortal'

const MODALITIES = ['X-Ray', 'MRI', 'CT Scan', 'Ultrasound', 'Echo', 'Mammography', 'PET Scan', 'Fluoroscopy']
const PRIORITIES  = ['routine', 'urgent', 'emergency']
const STATUS_COLORS = {
  ordered:     'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
}
const PAGE_SIZE = 20

export default function Radiology() {
  const [orders, setOrders]     = useState([])
  const [stats, setStats]       = useState({})
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalityFilter, setModalityFilter] = useState('')
  const [showOrderModal, setShowOrderModal]   = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [editOrder, setEditOrder] = useState(null)
  const [reportOrder, setReportOrder] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [page, setPage]         = useState(1)
  const [uploadingId, setUploadingId] = useState(null)
  const [imageMap, setImageMap]   = useState({})   // orderId -> url
  const fileInputRef = useRef(null)
  const uploadTargetId = useRef(null)

  const [orderForm, setOrderForm] = useState({
    patient_id: '', doctor_id: '', modality: 'X-Ray', body_part: '',
    clinical_notes: '', priority: 'routine', scheduled_at: '',
  })
  const [reportForm, setReportForm] = useState({
    radiologist_name: '', findings: '', impression: '', recommendations: '', report_date: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [oRes, sRes] = await Promise.all([
        api.get('/radiology/orders', {
          params: {
            status:   statusFilter   || undefined,
            modality: modalityFilter || undefined,
            search:   search         || undefined,
          },
        }),
        api.get('/radiology/stats'),
      ])
      setOrders(oRes.data)
      setStats(sRes.data)
      setPage(1)
    } catch {}
    setLoading(false)
  }, [statusFilter, modalityFilter, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/doctors').then(r => setDoctors(r.data)).catch(() => {})
  }, [])

  const searchPatients = async (q) => {
    if (q.length < 2) { setPatients([]); return }
    const r = await api.get('/patients', { params: { search: q, limit: 10 } })
    setPatients(r.data)
  }

  const openNewOrder = () => {
    setEditOrder(null)
    setOrderForm({
      patient_id: '', doctor_id: '', modality: 'X-Ray', body_part: '',
      clinical_notes: '', priority: 'routine', scheduled_at: '',
    })
    setPatientSearch('')
    setPatients([])
    setShowOrderModal(true)
  }

  const openEditOrder = (o) => {
    setEditOrder(o)
    setOrderForm({
      patient_id:    o.patient_id,
      doctor_id:     o.doctor_id     || '',
      modality:      o.modality,
      body_part:     o.body_part     || '',
      clinical_notes: o.clinical_notes || o.clinical_info || '',
      priority:      o.priority,
      scheduled_at:  o.scheduled_at  || '',
    })
    setPatientSearch(o.patient_name)
    setShowOrderModal(true)
  }

  const openReportModal = (o) => {
    setReportOrder(o)
    setReportForm({
      radiologist_name: o.report?.radiologist_name || '',
      findings:         o.report?.findings         || '',
      impression:       o.report?.impression       || '',
      recommendations:  o.report?.recommendations  || '',
      report_date:      o.report?.report_date      || new Date().toISOString().slice(0, 10),
    })
    setShowReportModal(true)
  }

  const handleSaveOrder = async (e) => {
    e.preventDefault()
    if (!orderForm.patient_id) { alert('Please select a patient'); return }
    setSaving(true)
    try {
      const payload = {
        patient_id:    Number(orderForm.patient_id),
        doctor_id:     orderForm.doctor_id ? Number(orderForm.doctor_id) : null,
        modality:      orderForm.modality,
        body_part:     orderForm.body_part,
        clinical_notes: orderForm.clinical_notes,
        priority:      orderForm.priority,
        scheduled_at:  orderForm.scheduled_at || null,
      }
      if (editOrder) {
        await api.put(`/radiology/orders/${editOrder.id}`, payload)
      } else {
        await api.post('/radiology/orders', payload)
      }
      setShowOrderModal(false)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  const handleSaveReport = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/radiology/orders/${reportOrder.id}/report`, reportForm)
      setShowReportModal(false)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this radiology order?')) return
    try {
      await api.delete(`/radiology/orders/${id}`)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed') }
  }

  const quickStatus = async (o, status) => {
    try {
      await api.put(`/radiology/orders/${o.id}`, { status })
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Update failed') }
  }

  // Image upload
  const triggerUpload = (orderId) => {
    uploadTargetId.current = orderId
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    const orderId = uploadTargetId.current
    if (!file || !orderId) return
    e.target.value = ''
    setUploadingId(orderId)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const r = await api.post(`/radiology/orders/${orderId}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url = r.data?.url || URL.createObjectURL(file)
      setImageMap(m => ({ ...m, [orderId]: url }))
    } catch {
      // backend endpoint may not exist yet — fall back to local preview
      const url = URL.createObjectURL(file)
      setImageMap(m => ({ ...m, [orderId]: url }))
    }
    setUploadingId(null)
  }

  const handlePrintReport = (o) => {
    const win = window.open('', '_blank', 'width=800,height=600')
    const report = o.report || {}
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Radiology Report – ${o.order_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #111; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .meta { font-size: 12px; color: #555; margin-bottom: 24px; }
          .section { margin-bottom: 20px; }
          .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }
          .section p { font-size: 14px; white-space: pre-wrap; margin: 0; }
          .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 12px; background: #d1fae5; color: #065f46; font-weight: bold; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>Radiology Report</h1>
        <div class="meta">
          Order #: ${o.order_number} &nbsp;|&nbsp;
          Patient: ${o.patient_name} &nbsp;|&nbsp;
          Modality: ${o.modality} &nbsp;|&nbsp;
          Body Part: ${o.body_part || '—'} &nbsp;|&nbsp;
          Priority: ${o.priority}<br/>
          Referring Doctor: ${o.doctor_name || '—'} &nbsp;|&nbsp;
          Radiologist: ${report.radiologist_name || '—'} &nbsp;|&nbsp;
          Report Date: ${report.report_date || '—'}
          &nbsp;&nbsp;<span class="badge">Report Ready</span>
        </div>
        <div class="section">
          <h2>Findings</h2>
          <p>${report.findings || '—'}</p>
        </div>
        <div class="section">
          <h2>Impression / Conclusion</h2>
          <p>${report.impression || '—'}</p>
        </div>
      </body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  const priorityColor = (p) =>
    p === 'emergency' ? 'bg-red-100 text-red-700'
    : p === 'urgent'  ? 'bg-orange-100 text-orange-700'
    : 'bg-green-100 text-green-700'

  // Pagination
  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE))
  const paged = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="animate-fadeIn space-y-5">
      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Radiology Department</h2>
          <p className="text-sm text-slate-500 mt-0.5">X-Ray, MRI, CT Scan, Ultrasound orders and reports</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-800 flex items-center gap-1">
            🖨️ Print
          </button>
          <button onClick={openNewOrder}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            ➕ New Order
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Orders",   value: stats.today_orders   || 0, icon: '📋', color: 'bg-blue-50 border-blue-200' },
          { label: 'Pending',          value: stats.pending        || 0, icon: '⏳', color: 'bg-yellow-50 border-yellow-200' },
          { label: 'In Progress',      value: stats.in_progress    || 0, icon: '🔬', color: 'bg-purple-50 border-purple-200' },
          { label: 'Completed Today',  value: stats.completed_today || 0, icon: '✅', color: 'bg-green-50 border-green-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-4 ${s.color}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 print:hidden">
        <input
          placeholder="Search patient..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[140px]"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none">
          <option value="">All Status</option>
          <option value="ordered">Ordered</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={modalityFilter} onChange={e => setModalityFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none">
          <option value="">All Modalities</option>
          {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={load} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">🔄</button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="text-4xl mb-3">📡</div>
            <p>No radiology orders found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Order #</th>
                    <th className="text-left px-4 py-3">Patient</th>
                    <th className="text-left px-4 py-3">Modality</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Body Part</th>
                    <th className="text-left px-4 py-3">Priority</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Price</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Report</th>
                    <th className="text-left px-4 py-3 print:hidden">Image</th>
                    <th className="text-left px-4 py-3 print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.order_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{o.patient_name}</div>
                        <div className="text-xs text-slate-400">{o.doctor_name || 'No doctor'}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{o.modality}</td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{o.body_part || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColor(o.priority)}`}>
                          {o.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 hidden lg:table-cell">
                        Rs. {(o.price || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={o.status}
                          onChange={e => quickStatus(o, e.target.value)}
                          className={`px-2 py-1 rounded text-xs font-medium border-0 outline-none cursor-pointer ${STATUS_COLORS[o.status] || 'bg-slate-100'}`}
                        >
                          <option value="ordered">Ordered</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {o.has_report ? (
                            <>
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                Report Ready
                              </span>
                              <button
                                onClick={() => openReportModal(o)}
                                className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handlePrintReport(o)}
                                className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200 print:hidden"
                              >
                                🖨️
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => openReportModal(o)}
                              className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                            >
                              Add Report
                            </button>
                          )}
                        </div>
                      </td>
                      {/* Image column — hidden in print */}
                      <td className="px-4 py-3 print:hidden">
                        <div className="flex items-center gap-2">
                          {imageMap[o.id] ? (
                            <a href={imageMap[o.id]} target="_blank" rel="noreferrer">
                              <img
                                src={imageMap[o.id]}
                                alt="thumbnail"
                                className="w-10 h-10 object-cover rounded border border-slate-200 hover:opacity-80"
                              />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          <button
                            onClick={() => triggerUpload(o.id)}
                            disabled={uploadingId === o.id}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs hover:bg-indigo-100 disabled:opacity-50 whitespace-nowrap"
                          >
                            {uploadingId === o.id ? '...' : '📎 Upload'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 print:hidden">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditOrder(o)}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(o.id)}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 print:hidden">
                <span className="text-xs text-slate-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, orders.length)} of {orders.length} orders
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-slate-50"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce((acc, p, i, arr) => {
                      if (i > 0 && p - arr[i - 1] > 1) acc.push('...')
                      acc.push(p)
                      return acc
                    }, [])
                    .map((p, i) =>
                      p === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-xs text-slate-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`px-3 py-1.5 text-xs border rounded-lg ${page === p ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-slate-50'}`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-slate-50"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Order Modal ───────────────────────────────────────────────────── */}
      {showOrderModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-800">
                {editOrder ? 'Edit Radiology Order' : 'New Radiology Order'}
              </h3>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSaveOrder} className="p-5 space-y-4">
              {/* Patient */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
                {editOrder ? (
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm">{editOrder.patient_name}</div>
                ) : (
                  <div className="relative">
                    <input
                      value={patientSearch}
                      onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value) }}
                      placeholder="Search patient..."
                      required={!orderForm.patient_id}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {patients.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                        {patients.map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setOrderForm(f => ({ ...f, patient_id: p.id }))
                              setPatientSearch(`${p.first_name} ${p.last_name}`)
                              setPatients([])
                            }}
                            className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                          >
                            {p.first_name} {p.last_name} — {p.phone}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Modality *</label>
                  <select
                    value={orderForm.modality}
                    onChange={e => setOrderForm(f => ({ ...f, modality: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Body Part</label>
                  <input
                    value={orderForm.body_part}
                    onChange={e => setOrderForm(f => ({ ...f, body_part: e.target.value }))}
                    placeholder="e.g. Chest, Knee, Abdomen"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Referring Doctor</label>
                <select
                  value={orderForm.doctor_id}
                  onChange={e => setOrderForm(f => ({ ...f, doctor_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select Doctor —</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={orderForm.priority}
                    onChange={e => setOrderForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled At</label>
                  <input
                    type="datetime-local"
                    value={orderForm.scheduled_at}
                    onChange={e => setOrderForm(f => ({ ...f, scheduled_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Clinical Notes</label>
                <textarea
                  value={orderForm.clinical_notes}
                  onChange={e => setOrderForm(f => ({ ...f, clinical_notes: e.target.value }))}
                  rows={2}
                  placeholder="Clinical notes for radiologist"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editOrder ? 'Update Order' : 'Create Order'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Report Modal ──────────────────────────────────────────────────── */}
      {showReportModal && reportOrder && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  {reportOrder.report ? '✏️ Edit Report' : '📝 Add Report'} — {reportOrder.order_number}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {reportOrder.modality} · {reportOrder.body_part} · {reportOrder.patient_name}
                  {reportOrder.report && <span className="ml-2 text-purple-600 font-medium">· Previously filed — updating</span>}
                </p>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSaveReport} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Radiologist Name</label>
                  <input
                    value={reportForm.radiologist_name}
                    onChange={e => setReportForm(f => ({ ...f, radiologist_name: e.target.value }))}
                    placeholder="Dr. Name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Report Date</label>
                  <input
                    type="date"
                    value={reportForm.report_date}
                    onChange={e => setReportForm(f => ({ ...f, report_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Findings *</label>
                <textarea
                  value={reportForm.findings}
                  onChange={e => setReportForm(f => ({ ...f, findings: e.target.value }))}
                  rows={4}
                  placeholder="Describe radiological findings in detail..."
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Impression / Conclusion *</label>
                <textarea
                  value={reportForm.impression}
                  onChange={e => setReportForm(f => ({ ...f, impression: e.target.value }))}
                  rows={3}
                  placeholder="Summary and diagnosis..."
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recommendations</label>
                <textarea
                  value={reportForm.recommendations}
                  onChange={e => setReportForm(f => ({ ...f, recommendations: e.target.value }))}
                  rows={2}
                  placeholder="Follow-up recommendations, further investigations..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : reportOrder.report ? '✏️ Update Report' : '💾 Save Report & Mark Completed'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Print-only styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
