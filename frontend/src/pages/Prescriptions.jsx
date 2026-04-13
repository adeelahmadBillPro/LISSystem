import { useState, useEffect } from 'react'
import api from '../api'
import ModalPortal from '../components/ModalPortal'

const ROUTES = ['Oral', 'IV', 'IM', 'Topical', 'Inhaled', 'Sublingual', 'Rectal', 'Other']
const FREQUENCIES = [
  'Once daily (OD)', 'Twice daily (BD)', 'Three times daily (TDS)',
  'Four times daily (QID)', 'Every 8 hours', 'Every 6 hours',
  'At night (HS)', 'As needed (PRN)', 'Once only (STAT)',
]

const emptyItem = () => ({
  medicine_name: '', dosage: '', frequency: 'Twice daily (BD)',
  duration: '5 days', route: 'Oral', instructions: '',
})

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([])
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewRx, setViewRx] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')

  const [form, setForm] = useState({
    patient_id: '',
    doctor_id: '',
    chief_complaint: '',
    diagnosis: '',
    notes: '',
    items: [emptyItem()],
  })

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    try {
      const [rxRes, patRes, docRes] = await Promise.all([
        api.get('/prescriptions'),
        api.get('/patients'),
        api.get('/doctors'),
      ])
      setPrescriptions(rxRes.data)
      setPatients(patRes.data)
      setDoctors(docRes.data)
    } catch (_) {}
    finally { setLoading(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.patient_id) return alert('Select a patient')
    if (form.items.some(i => !i.medicine_name.trim())) return alert('Fill all medicine names')

    setSaving(true)
    try {
      await api.post('/prescriptions', {
        ...form,
        patient_id: Number(form.patient_id),
        doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
      })
      setMsg('Prescription saved!')
      setTimeout(() => setMsg(''), 2500)
      setShowForm(false)
      setForm({ patient_id: '', doctor_id: '', chief_complaint: '', diagnosis: '', notes: '', items: [emptyItem()] })
      fetchAll()
    } catch (err) {
      alert(err.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }))
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  const updateItem = (idx, field, value) => setForm(f => ({
    ...f,
    items: f.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
  }))

  const deleteRx = async (id) => {
    if (!confirm('Delete this prescription?')) return
    try {
      await api.delete(`/prescriptions/${id}`)
      fetchAll()
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed')
    }
  }

  const printRx = (rx) => {
    const win = window.open('', '_blank', 'width=700,height=900')
    win.document.write(`
      <html><head><title>Prescription #${rx.id}</title>
      <style>
        body { font-family: Arial; padding: 30px; font-size: 13px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #1e293b; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
        td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; }
        .label { font-weight: bold; color: #334155; }
        .section { margin: 12px 0; }
        @media print { button { display: none; } }
      </style></head><body>
      <h1>Prescription</h1>
      <div class="meta">
        <strong>Patient:</strong> ${rx.patient_name} (MRN: ${rx.patient_mrn}) &nbsp;
        <strong>Doctor:</strong> ${rx.doctor_name || '—'} &nbsp;
        <strong>Date:</strong> ${new Date(rx.created_at).toLocaleDateString('en-PK')}
      </div>
      ${rx.chief_complaint ? `<div class="section"><span class="label">Chief Complaint:</span> ${rx.chief_complaint}</div>` : ''}
      ${rx.diagnosis ? `<div class="section"><span class="label">Diagnosis:</span> ${rx.diagnosis}</div>` : ''}
      <table>
        <thead><tr>
          <th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th><th>Instructions</th>
        </tr></thead>
        <tbody>
          ${rx.items.map((item, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${item.medicine_name}</strong></td>
              <td>${item.dosage || '—'}</td>
              <td>${item.frequency || '—'}</td>
              <td>${item.duration || '—'}</td>
              <td>${item.route || '—'}</td>
              <td>${item.instructions || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${rx.notes ? `<div class="section" style="margin-top:16px"><span class="label">Notes:</span> ${rx.notes}</div>` : ''}
      <div style="margin-top:40px; text-align:right; font-size:12px; color:#666">
        Signature: _________________________ &nbsp;&nbsp; Dr. ${rx.doctor_name || ''}
      </div>
      <button onclick="window.print()" style="margin-top:20px; padding:8px 20px; background:#1e293b; color:white; border:none; border-radius:4px; cursor:pointer">Print</button>
      </body></html>
    `)
    win.document.close()
  }

  const filtered = prescriptions.filter(rx =>
    !search || rx.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
    rx.patient_mrn?.toLowerCase().includes(search.toLowerCase()) ||
    rx.diagnosis?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-center py-20 text-slate-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Prescriptions</h2>
          <p className="text-sm text-slate-500 mt-1">{prescriptions.length} prescription(s)</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          + New Prescription
        </button>
      </div>

      {msg && <div className="mb-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm">{msg}</div>}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by patient name, MRN, or diagnosis..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">No prescriptions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Patient</th>
                <th className="text-left px-4 py-3 font-medium">Doctor</th>
                <th className="text-left px-4 py-3 font-medium">Diagnosis</th>
                <th className="text-left px-4 py-3 font-medium">Medicines</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(rx => (
                <tr key={rx.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 text-xs">#{rx.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{rx.patient_name}</div>
                    <div className="text-xs text-slate-400">{rx.patient_mrn}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{rx.doctor_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{rx.diagnosis || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                      {rx.items.length} medicine(s)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(rx.created_at).toLocaleDateString('en-PK')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewRx(rx)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        View
                      </button>
                      <button
                        onClick={() => printRx(rx)}
                        className="text-green-600 hover:underline text-xs"
                      >
                        Print
                      </button>
                      <button
                        onClick={() => deleteRx(rx.id)}
                        className="text-red-500 hover:underline text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View Modal */}
      {viewRx && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Prescription #{viewRx.id}</h3>
              <div className="flex gap-2">
                <button onClick={() => printRx(viewRx)} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">Print</button>
                <button onClick={() => setViewRx(null)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded text-xs hover:bg-slate-300">Close</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><span className="text-slate-500">Patient:</span> <strong>{viewRx.patient_name}</strong> ({viewRx.patient_mrn})</div>
              <div><span className="text-slate-500">Doctor:</span> {viewRx.doctor_name || '—'}</div>
              <div><span className="text-slate-500">Date:</span> {new Date(viewRx.created_at).toLocaleDateString('en-PK')}</div>
              {viewRx.chief_complaint && <div><span className="text-slate-500">Complaint:</span> {viewRx.chief_complaint}</div>}
              {viewRx.diagnosis && <div className="col-span-2"><span className="text-slate-500">Diagnosis:</span> <strong>{viewRx.diagnosis}</strong></div>}
            </div>
            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden mb-3">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Medicine</th>
                  <th className="text-left px-3 py-2">Dose</th>
                  <th className="text-left px-3 py-2">Frequency</th>
                  <th className="text-left px-3 py-2">Duration</th>
                  <th className="text-left px-3 py-2">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewRx.items.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{item.medicine_name}</td>
                    <td className="px-3 py-2">{item.dosage || '—'}</td>
                    <td className="px-3 py-2">{item.frequency || '—'}</td>
                    <td className="px-3 py-2">{item.duration || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{item.instructions || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {viewRx.notes && <p className="text-sm text-slate-600"><strong>Notes:</strong> {viewRx.notes}</p>}
          </div>
        </div>
        </ModalPortal>
      )}

      {/* New Prescription Modal */}
      {showForm && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">New Prescription</h3>
            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
                  <select
                    required
                    value={form.patient_id}
                    onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.mrn})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Doctor</label>
                  <select
                    value={form.doctor_id}
                    onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select doctor</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chief Complaint</label>
                <input
                  type="text"
                  value={form.chief_complaint}
                  onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
                  placeholder="e.g. Fever, cough, headache"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Diagnosis</label>
                <input
                  type="text"
                  value={form.diagnosis}
                  onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
                  placeholder="e.g. Upper Respiratory Tract Infection"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Medicines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">Medicines *</label>
                  <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:underline">+ Add Medicine</button>
                </div>
                <div className="space-y-3">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-600">Medicine #{idx + 1}</span>
                        {form.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} className="text-red-500 text-xs hover:underline">Remove</button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div className="col-span-2 md:col-span-1">
                          <input
                            type="text"
                            placeholder="Medicine name *"
                            required
                            value={item.medicine_name}
                            onChange={e => updateItem(idx, 'medicine_name', e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Dosage (e.g. 500mg)"
                            value={item.dosage}
                            onChange={e => updateItem(idx, 'dosage', e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <select
                            value={item.frequency}
                            onChange={e => updateItem(idx, 'frequency', e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          >
                            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Duration (e.g. 5 days)"
                            value={item.duration}
                            onChange={e => updateItem(idx, 'duration', e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <select
                            value={item.route}
                            onChange={e => updateItem(idx, 'route', e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          >
                            {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Instructions (e.g. After meal)"
                            value={item.instructions}
                            onChange={e => updateItem(idx, 'instructions', e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Any additional instructions for the patient..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Prescription'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
