import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import ModalPortal from '../components/ModalPortal'

const STATUS_COLORS = {
  waiting:     'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
}
const STATUS_LABELS = { waiting: 'Waiting', in_progress: 'In Progress', completed: 'Completed' }

export default function OPD() {
  const [visits, setVisits]   = useState([])
  const [stats, setStats]     = useState({})
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10))
  const [showModal, setShowModal] = useState(false)
  const [editVisit, setEditVisit] = useState(null)
  const [saving, setSaving]   = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [patientSearch, setPatientSearch] = useState('')
  const [form, setForm] = useState({
    patient_id: '', doctor_id: '', chief_complaint: '', diagnosis: '',
    notes: '', fee: 0, status: 'waiting',
    referred_to_lab: false, referred_to_radiology: false, referred_to_pharmacy: false,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [vRes, sRes] = await Promise.all([
        api.get('/opd/visits', { params: { date_filter: dateFilter, status: statusFilter || undefined, search: search || undefined } }),
        api.get('/opd/stats'),
      ])
      setVisits(vRes.data)
      setStats(sRes.data)
    } catch {}
    setLoading(false)
  }, [dateFilter, statusFilter, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/doctors').then(r => setDoctors(r.data)).catch(() => {})
  }, [])

  // Auto-open new visit when navigated from Appointments (?patient_id=X)
  useEffect(() => {
    const pid   = searchParams.get('patient_id')
    const apptId = searchParams.get('appt_id')
    if (!pid) return
    api.get(`/patients/${pid}`).then(r => {
      const p = r.data
      setEditVisit(null)
      setForm(f => ({ ...f, patient_id: p.id, notes: apptId ? `From appointment #${apptId}` : '' }))
      setPatientSearch(`${p.mrn} — ${p.first_name} ${p.last_name}`)
      setPatients([])
      setShowModal(true)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const searchPatients = async (q) => {
    if (q.length < 2) { setPatients([]); return }
    const r = await api.get('/patients', { params: { search: q, limit: 10 } })
    setPatients(r.data)
  }

  const openNew = () => {
    setEditVisit(null)
    setForm({ patient_id: '', doctor_id: '', chief_complaint: '', diagnosis: '',
      notes: '', fee: 0, status: 'waiting',
      referred_to_lab: false, referred_to_radiology: false, referred_to_pharmacy: false })
    setPatientSearch('')
    setPatients([])
    setShowModal(true)
  }

  const openEdit = (v) => {
    setEditVisit(v)
    setForm({
      patient_id: v.patient_id, doctor_id: v.doctor_id || '',
      chief_complaint: v.chief_complaint || '', diagnosis: v.diagnosis || '',
      notes: v.notes || '', fee: v.fee, status: v.status,
      referred_to_lab: v.referred_to_lab, referred_to_radiology: v.referred_to_radiology,
      referred_to_pharmacy: v.referred_to_pharmacy,
    })
    setPatientSearch(v.patient_name || '')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.patient_id) { alert('Please select a patient'); return }
    setSaving(true)
    try {
      if (editVisit) {
        await api.put(`/opd/visits/${editVisit.id}`, form)
      } else {
        await api.post('/opd/visits', form)
        // Auto-complete appointment if we came from one
        const apptId = searchParams.get('appt_id')
        if (apptId) {
          api.put(`/appointments/${apptId}`, { status: 'completed' }).catch(() => {})
        }
      }
      setShowModal(false)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Save failed')
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this visit?')) return
    try {
      await api.delete(`/opd/visits/${id}`)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed') }
  }

  const quickStatus = async (v, status) => {
    try {
      await api.put(`/opd/visits/${v.id}`, { status })
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Update failed') }
  }

  return (
    <div className="animate-fadeIn space-y-5">
      {/* From-appointment banner */}
      {searchParams.get('patient_id') && searchParams.get('appt_id') && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-blue-600 text-lg">🏥</span>
          <div>
            <p className="text-sm font-semibold text-blue-800">OPD Visit — From Appointment</p>
            <p className="text-xs text-blue-600">Patient pre-selected. Fill in visit details and save — appointment will auto-complete.</p>
          </div>
          <button onClick={() => navigate('/appointments')}
            className="ml-auto text-xs text-blue-700 underline hover:no-underline">← Appointments</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">OPD — Outpatient Department</h2>
          <p className="text-sm text-slate-500 mt-0.5">Token → Doctor → Lab / Radiology / Pharmacy</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
          <span>➕</span> New Visit
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Today', value: stats.total || 0, color: 'bg-blue-50 border-blue-200', icon: '📋' },
          { label: 'Waiting', value: stats.waiting || 0, color: 'bg-yellow-50 border-yellow-200', icon: '⏳' },
          { label: 'In Progress', value: stats.in_progress || 0, color: 'bg-purple-50 border-purple-200', icon: '🩺' },
          { label: 'Completed', value: stats.completed || 0, color: 'bg-green-50 border-green-200', icon: '✅' },
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
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <input placeholder="Search patient..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[160px]" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Status</option>
          <option value="waiting">Waiting</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <button onClick={load} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">🔄 Refresh</button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading visits...</div>
        ) : visits.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="text-4xl mb-3">🏥</div>
            <p>No OPD visits for {dateFilter}</p>
            <button onClick={openNew} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">New Visit</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white text-xs">
              <tr>
                <th className="text-left px-4 py-3">Visit #</th>
                <th className="text-left px-4 py-3">Patient</th>
                <th className="text-left px-4 py-3">Doctor</th>
                <th className="text-left px-4 py-3">Complaint</th>
                <th className="text-left px-4 py-3">Referrals</th>
                <th className="text-left px-4 py-3">Fee</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visits.map(v => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{v.visit_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{v.patient_name}</div>
                    <div className="text-xs text-slate-400">{v.patient_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.doctor_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate">{v.chief_complaint || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {v.referred_to_lab && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">Lab</span>}
                      {v.referred_to_radiology && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded font-medium">Radiology</span>}
                      {v.referred_to_pharmacy && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded font-medium">Pharmacy</span>}
                      {!v.referred_to_lab && !v.referred_to_radiology && !v.referred_to_pharmacy && <span className="text-slate-300 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-medium">Rs. {v.fee?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <select value={v.status}
                      onChange={e => quickStatus(v, e.target.value)}
                      className={`px-2 py-1 rounded text-xs font-medium border-0 outline-none cursor-pointer ${STATUS_COLORS[v.status] || 'bg-slate-100'}`}>
                      <option value="waiting">Waiting</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => openEdit(v)}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">Edit</button>
                      <button onClick={() => handleDelete(v.id)}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Del</button>
                      {v.referred_to_lab && (
                        <button
                          onClick={() => navigate(`/samples/new?patient_id=${v.patient_id}&from_opd=${v.id}`)}
                          className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 whitespace-nowrap"
                          title="Create lab sample for this visit">
                          🧪 Sample
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/ipd?patient_id=${v.patient_id}&action=admit`)}
                        className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200 whitespace-nowrap"
                        title="Admit this patient to IPD">
                        🛏️ Admit IPD
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{ maxHeight: '92vh' }}>
            {/* Header — fixed */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-slate-800">{editVisit ? 'Edit OPD Visit' : 'New OPD Visit'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            {/* Body — scrollable */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

              {/* Patient */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Patient *</label>
                {editVisit ? (
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-700">{editVisit.patient_name}</div>
                ) : (
                  <div className="relative">
                    <input value={patientSearch}
                      onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value) }}
                      placeholder="Search patient by name..."
                      required={!form.patient_id}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    {patients.length > 0 && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-36 overflow-y-auto">
                        {patients.map(p => (
                          <div key={p.id}
                            onClick={() => { setForm(f => ({ ...f, patient_id: p.id })); setPatientSearch(`${p.first_name} ${p.last_name}`); setPatients([]) }}
                            className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0">
                            <span className="font-medium">{p.first_name} {p.last_name}</span>
                            <span className="text-slate-400 ml-2 text-xs">{p.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Doctor + Status in one row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Doctor</label>
                  <select value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select Doctor —</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}{d.specialization ? ` (${d.specialization})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="waiting">Waiting</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Complaint + Diagnosis */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Chief Complaint</label>
                  <textarea value={form.chief_complaint} onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
                    rows={2} placeholder="Patient's complaint"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Diagnosis</label>
                  <textarea value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
                    rows={2} placeholder="Doctor's diagnosis"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>

              {/* Fee + Referrals + Notes in compact layout */}
              <div className="grid grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Consultation Fee (Rs.)</label>
                  <input type="number" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Refer To</label>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { key: 'referred_to_lab', label: '🧪 Lab' },
                      { key: 'referred_to_radiology', label: '📡 Radiology' },
                      { key: 'referred_to_pharmacy', label: '💊 Pharmacy' },
                    ].map(r => (
                      <label key={r.key} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={form[r.key]}
                          onChange={e => setForm(f => ({ ...f, [r.key]: e.target.checked }))}
                          className="w-3.5 h-3.5 rounded accent-blue-600" />
                        {r.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Additional notes"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>

            {/* Footer — fixed */}
            <div className="px-5 py-3 border-t border-slate-100 flex gap-3 flex-shrink-0">
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editVisit ? 'Update Visit' : 'Create Visit'}
              </button>
              <button type="button" onClick={() => setShowModal(false)}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
