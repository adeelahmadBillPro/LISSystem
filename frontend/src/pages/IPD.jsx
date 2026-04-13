import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import ModalPortal from '../components/ModalPortal'

const STATUS_COLORS = {
  admitted:    'bg-green-100 text-green-700',
  discharged:  'bg-slate-100 text-slate-600',
  transferred: 'bg-yellow-100 text-yellow-700',
}

const today = () => new Date().toISOString().slice(0, 10)

export default function IPD() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Core data
  const [admissions, setAdmissions] = useState([])
  const [stats, setStats]           = useState({})
  const [wards, setWards]           = useState([])
  const [beds, setBeds]             = useState([])
  const [patients, setPatients]     = useState([])
  const [doctors, setDoctors]       = useState([])
  const [loading, setLoading]       = useState(true)

  // Filters
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('admitted')

  // Admit / Edit modal
  const [showModal, setShowModal]   = useState(false)
  const [editAdm, setEditAdm]       = useState(null)
  const [saving, setSaving]         = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [form, setForm] = useState({
    patient_id: '', bed_id: '', doctor_id: '', ward_id: '',
    admission_type: 'planned', diagnosis: '', notes: '',
  })

  // Discharge modal
  const [showDischargeModal, setShowDischargeModal] = useState(false)
  const [dischargeTarget, setDischargeTarget]       = useState(null)
  const [dischargeForm, setDischargeForm] = useState({ discharge_notes: '', discharge_date: today() })
  const [discharging, setDischarging]     = useState(false)

  // Transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferTarget, setTransferTarget]       = useState(null)
  const [transferBeds, setTransferBeds]           = useState([])
  const [transferForm, setTransferForm] = useState({ ward_id: '', bed_id: '' })
  const [transferring, setTransferring]           = useState(false)

  // Detail modal
  const [showDetail, setShowDetail]   = useState(false)
  const [detailAdm, setDetailAdm]     = useState(null)

  // Treatment notes panel (expanded row ids)
  const [expandedNotes, setExpandedNotes]   = useState({})
  const [noteTexts, setNoteTexts]           = useState({})
  const [savingNote, setSavingNote]         = useState({})

  // ── Data loaders ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, sRes] = await Promise.all([
        api.get('/admissions', { params: { status: statusFilter || undefined, search: search || undefined } }),
        api.get('/admissions/stats'),
      ])
      setAdmissions(aRes.data)
      setStats(sRes.data)
    } catch {}
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/wards').then(r => setWards(r.data)).catch(() => {})
    api.get('/doctors').then(r => setDoctors(r.data)).catch(() => {})
  }, [])

  // Auto-open admit modal when navigated here with ?patient_id=X&action=admit
  useEffect(() => {
    const pid    = searchParams.get('patient_id')
    const action = searchParams.get('action')
    if (!pid || action !== 'admit') return
    api.get(`/patients/${pid}`).then(r => {
      const p = r.data
      setEditAdm(null)
      setForm({ patient_id: p.id, bed_id: '', doctor_id: '', ward_id: '', admission_type: 'planned', diagnosis: '', notes: '' })
      setPatientSearch(`${p.mrn} — ${p.first_name} ${p.last_name}`)
      setPatients([])
      setShowModal(true)
    }).catch(() => {
      // fallback: search by ID
      api.get('/patients', { params: { search: pid, limit: 1 } }).then(r => {
        if (r.data.length > 0) {
          const p = r.data[0]
          setEditAdm(null)
          setForm({ patient_id: p.id, bed_id: '', doctor_id: '', ward_id: '', admission_type: 'planned', diagnosis: '', notes: '' })
          setPatientSearch(`${p.mrn} — ${p.first_name} ${p.last_name}`)
          setPatients([])
          setShowModal(true)
        }
      }).catch(() => {})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Beds for the admit/edit modal
  useEffect(() => {
    if (form.ward_id) {
      api.get(`/wards/${form.ward_id}/beds`)
        .then(r => setBeds(r.data.filter(b => b.status === 'available')))
        .catch(() => setBeds([]))
    } else {
      setBeds([])
    }
  }, [form.ward_id])

  // Beds for the transfer modal
  useEffect(() => {
    if (transferForm.ward_id) {
      api.get(`/wards/${transferForm.ward_id}/beds`)
        .then(r => setTransferBeds(r.data.filter(b => b.status === 'available')))
        .catch(() => setTransferBeds([]))
    } else {
      setTransferBeds([])
    }
  }, [transferForm.ward_id])

  // ── Patient search autocomplete ───────────────────────────────────────────────

  const searchPatients = async (q) => {
    if (q.length < 2) { setPatients([]); return }
    try {
      const r = await api.get('/patients', { params: { search: q, limit: 10 } })
      setPatients(r.data)
    } catch {}
  }

  // ── Admit / Edit modal ────────────────────────────────────────────────────────

  const openNew = () => {
    setEditAdm(null)
    setForm({ patient_id: '', bed_id: '', doctor_id: '', ward_id: '', admission_type: 'planned', diagnosis: '', notes: '' })
    setPatientSearch('')
    setPatients([])
    setShowModal(true)
  }

  const openEdit = (a) => {
    setEditAdm(a)
    setForm({
      patient_id:     a.patient_id,
      bed_id:         a.bed_id    || '',
      doctor_id:      a.doctor_id || '',
      ward_id:        a.ward_id   || '',
      admission_type: a.admission_type,
      diagnosis:      a.diagnosis || '',
      notes:          a.notes     || '',
    })
    setPatientSearch(a.patient_name)
    setPatients([])
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.patient_id) { alert('Please select a patient'); return }
    setSaving(true)
    try {
      const payload = {
        patient_id:     form.patient_id,
        ward_id:        form.ward_id   || null,
        bed_id:         form.bed_id    || null,
        doctor_id:      form.doctor_id || null,
        admission_type: form.admission_type,
        diagnosis:      form.diagnosis,
        notes:          form.notes,
      }
      if (editAdm) {
        await api.put(`/admissions/${editAdm.id}`, payload)
      } else {
        await api.post('/admissions', payload)
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

  // ── Discharge modal ───────────────────────────────────────────────────────────

  const openDischarge = (a) => {
    setDischargeTarget(a)
    setDischargeForm({ discharge_notes: '', discharge_date: today() })
    setShowDischargeModal(true)
  }

  const handleDischarge = async (e) => {
    e.preventDefault()
    if (!dischargeTarget) return
    setDischarging(true)
    try {
      await api.put(`/admissions/${dischargeTarget.id}/discharge`, {
        discharge_notes: dischargeForm.discharge_notes,
        discharge_date:  dischargeForm.discharge_date,
      })
      setShowDischargeModal(false)
      load()
      // Offer billing navigation
      const goBilling = window.confirm(
        `${dischargeTarget.patient_name} discharged.\n\nGenerate invoice for this admission?`
      )
      if (goBilling) {
        navigate('/billing', {
          state: {
            ipd_admission_id: dischargeTarget.id,
            patient_id:       dischargeTarget.patient_id,
            patient_name:     dischargeTarget.patient_name,
            admission_number: dischargeTarget.admission_number,
            ward_name:        dischargeTarget.ward_name,
            bed_number:       dischargeTarget.bed_number,
            doctor_name:      dischargeTarget.doctor_name,
            admission_date:   dischargeTarget.admission_date,
            discharge_date:   dischargeForm.discharge_date,
          }
        })
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Discharge failed')
    }
    setDischarging(false)
  }

  // ── Ward transfer modal ───────────────────────────────────────────────────────

  const openTransfer = (a) => {
    setTransferTarget(a)
    setTransferForm({ ward_id: '', bed_id: '' })
    setTransferBeds([])
    setShowTransferModal(true)
  }

  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!transferForm.ward_id || !transferForm.bed_id) { alert('Select ward and bed'); return }
    setTransferring(true)
    try {
      await api.put(`/admissions/${transferTarget.id}`, {
        ward_id: transferForm.ward_id,
        bed_id:  transferForm.bed_id,
        status:  'transferred',
      })
      setShowTransferModal(false)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Transfer failed')
    }
    setTransferring(false)
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this admission record? This cannot be undone.')) return
    try {
      await api.delete(`/admissions/${id}`)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed') }
  }

  // ── Treatment notes (inline per row) ─────────────────────────────────────────

  const toggleNotes = (id) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }))
    if (!noteTexts[id]) setNoteTexts(prev => ({ ...prev, [id]: '' }))
  }

  const saveNote = async (adm) => {
    const text = noteTexts[adm.id]?.trim()
    if (!text) return
    setSavingNote(prev => ({ ...prev, [adm.id]: true }))
    try {
      const timestamp  = new Date().toLocaleString('en-PK', { hour12: true })
      const combined   = adm.notes
        ? `${adm.notes}\n\n[${timestamp}]\n${text}`
        : `[${timestamp}]\n${text}`
      await api.put(`/admissions/${adm.id}`, { notes: combined })
      setNoteTexts(prev => ({ ...prev, [adm.id]: '' }))
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save note')
    }
    setSavingNote(prev => ({ ...prev, [adm.id]: false }))
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const daysSince = (dateStr) => {
    if (!dateStr) return '—'
    const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
    return days === 0 ? 'Today' : `${days}d`
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK') : '—'

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fadeIn space-y-5">

      {/* From-appointment banner */}
      {searchParams.get('action') === 'admit' && searchParams.get('patient_id') && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3 print:hidden">
          <span className="text-green-600 text-lg">🛏️</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Admitting from Appointment</p>
            <p className="text-xs text-green-600">Patient has been pre-selected below. Complete the ward/bed assignment and save.</p>
          </div>
          <button onClick={() => navigate('/appointments')}
            className="ml-auto text-xs text-green-700 underline hover:no-underline">← Back to Appointments</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">IPD — Inpatient Department</h2>
          <p className="text-sm text-slate-500 mt-0.5">Patient admissions, bed assignment and discharge</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 flex items-center gap-2">
            🖨️ Print
          </button>
          <button onClick={openNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            🛏️ Admit Patient
          </button>
        </div>
      </div>

      {/* Print header — only visible when printing */}
      <div className="hidden print:block text-center mb-4">
        <h2 className="text-xl font-bold">IPD Admissions Report</h2>
        <p className="text-sm text-slate-500">Printed: {new Date().toLocaleString('en-PK', { hour12: true })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
        {[
          { label: 'Currently Admitted', value: stats.total_admitted    || 0, icon: '🛏️', color: 'bg-blue-50 border-blue-200' },
          { label: 'Total Beds',         value: stats.total_beds        || 0, icon: '🏥', color: 'bg-slate-50 border-slate-200' },
          { label: 'Available',          value: stats.available_beds    || 0, icon: '✅', color: 'bg-green-50 border-green-200' },
          { label: 'Occupied',           value: stats.occupied_beds     || 0, icon: '❌', color: 'bg-red-50 border-red-200' },
          { label: "Today's Admissions", value: stats.today_admissions  || 0, icon: '📥', color: 'bg-purple-50 border-purple-200' },
          { label: "Today's Discharges", value: stats.today_discharges  || 0, icon: '📤', color: 'bg-orange-50 border-orange-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-3 ${s.color}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-500">{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <div className="text-xl font-bold text-slate-800">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 print:hidden">
        <input
          placeholder="Search patient..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[160px]"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All</option>
          <option value="admitted">Admitted</option>
          <option value="discharged">Discharged</option>
          <option value="transferred">Transferred</option>
        </select>
        <button onClick={load} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
          🔄 Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto print:shadow-none print:border-slate-300">
        {loading ? (
          <div className="p-12 text-center text-slate-400 print:hidden">Loading admissions...</div>
        ) : admissions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 print:hidden">
            <div className="text-4xl mb-3">🛏️</div>
            <p>No admissions found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white text-xs print:bg-slate-200 print:text-slate-800">
              <tr>
                <th className="text-left px-4 py-3">Admission #</th>
                <th className="text-left px-4 py-3">Patient</th>
                <th className="text-left px-4 py-3">Ward / Bed</th>
                <th className="text-left px-4 py-3">Doctor</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Days</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {admissions.map(a => (
                <>
                  <tr key={a.id} className="hover:bg-slate-50">
                    {/* Admission # */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setDetailAdm(a); setShowDetail(true) }}
                        className="font-mono text-xs text-blue-600 hover:underline print:text-slate-700 print:no-underline"
                      >
                        {a.admission_number}
                      </button>
                    </td>

                    {/* Patient */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{a.patient_name}</div>
                      <div className="text-xs text-slate-400">{a.patient_phone}</div>
                    </td>

                    {/* Ward / Bed */}
                    <td className="px-4 py-3">
                      {a.ward_name ? (
                        <div>
                          <div className="font-medium text-slate-700">{a.ward_name}</div>
                          <div className="text-xs text-slate-400">Bed: {a.bed_number}</div>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Doctor */}
                    <td className="px-4 py-3 text-slate-600">{a.doctor_name || '—'}</td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.admission_type === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {a.admission_type}
                      </span>
                    </td>

                    {/* Days */}
                    <td className="px-4 py-3 text-slate-600 font-medium">{daysSince(a.admission_date)}</td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-slate-100'}`}>
                        {a.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 print:hidden">
                      <div className="flex flex-wrap gap-1">
                        {a.status === 'admitted' && (
                          <>
                            <button onClick={() => openDischarge(a)}
                              className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200">
                              Discharge
                            </button>
                            <button onClick={() => openTransfer(a)}
                              className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200">
                              Transfer
                            </button>
                          </>
                        )}
                        <button onClick={() => toggleNotes(a.id)}
                          className={`px-2 py-1 rounded text-xs ${expandedNotes[a.id] ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>
                          Notes
                        </button>
                        <button onClick={() => openEdit(a)}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(a.id)}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Treatment notes expandable row */}
                  {expandedNotes[a.id] && (
                    <tr key={`${a.id}-notes`} className="bg-indigo-50 print:hidden">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Treatment Notes</p>

                          {/* Existing notes */}
                          {a.notes ? (
                            <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-white border border-indigo-100 rounded-lg p-3 max-h-36 overflow-y-auto font-sans">
                              {a.notes}
                            </pre>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No treatment notes yet.</p>
                          )}

                          {/* Add new note */}
                          {a.status === 'admitted' && (
                            <div className="flex gap-2 items-end">
                              <textarea
                                value={noteTexts[a.id] || ''}
                                onChange={e => setNoteTexts(prev => ({ ...prev, [a.id]: e.target.value }))}
                                rows={2}
                                placeholder="Add treatment note..."
                                className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-white"
                              />
                              <button
                                onClick={() => saveNote(a)}
                                disabled={savingNote[a.id] || !noteTexts[a.id]?.trim()}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                              >
                                {savingNote[a.id] ? 'Saving...' : 'Add Note'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Admit / Edit Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">{editAdm ? 'Edit Admission' : 'Admit Patient'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">

              {/* Patient */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
                {editAdm ? (
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm">{editAdm.patient_name}</div>
                ) : (
                  <div className="relative">
                    <input
                      value={patientSearch}
                      onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value) }}
                      placeholder="Search patient by name or phone..."
                      required={!form.patient_id}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {form.patient_id && (
                      <span className="absolute right-3 top-2.5 text-green-500 text-xs">✓ Selected</span>
                    )}
                    {patients.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-44 overflow-y-auto">
                        {patients.map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setForm(f => ({ ...f, patient_id: p.id }))
                              setPatientSearch(`${p.first_name} ${p.last_name}`)
                              setPatients([])
                            }}
                            className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
                          >
                            <span className="font-medium">{p.first_name} {p.last_name}</span>
                            <span className="text-slate-400 ml-2">{p.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Ward → Bed */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ward</label>
                  <select
                    value={form.ward_id}
                    onChange={e => setForm(f => ({ ...f, ward_id: e.target.value, bed_id: '' }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select Ward —</option>
                    {wards.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.available_beds ?? '?'} avail.)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bed</label>
                  <select
                    value={form.bed_id}
                    onChange={e => setForm(f => ({ ...f, bed_id: e.target.value }))}
                    disabled={!form.ward_id}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">— Select Bed —</option>
                    {beds.map(b => (
                      <option key={b.id} value={b.id}>Bed {b.bed_number} ({b.bed_type})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Doctor + Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Doctor</label>
                  <select
                    value={form.doctor_id}
                    onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select Doctor —</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admission Type</label>
                  <select
                    value={form.admission_type}
                    onChange={e => setForm(f => ({ ...f, admission_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="planned">Planned</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Diagnosis</label>
                <textarea
                  value={form.diagnosis}
                  onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
                  rows={2}
                  placeholder="Admission diagnosis..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : editAdm ? 'Update Admission' : 'Admit Patient'}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Discharge Modal ────────────────────────────────────────────────────── */}
      {showDischargeModal && dischargeTarget && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Discharge Patient</h3>
                <p className="text-sm text-slate-500 mt-0.5">{dischargeTarget.patient_name}</p>
              </div>
              <button onClick={() => setShowDischargeModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleDischarge} className="p-6 space-y-4">
              {/* Summary */}
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Ward / Bed</span>
                  <span className="font-medium text-slate-700">{dischargeTarget.ward_name} — Bed {dischargeTarget.bed_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Admitted</span>
                  <span className="font-medium text-slate-700">{fmtDate(dischargeTarget.admission_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Days stayed</span>
                  <span className="font-medium text-slate-700">{daysSince(dischargeTarget.admission_date)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Discharge Date *</label>
                <input
                  type="date"
                  value={dischargeForm.discharge_date}
                  onChange={e => setDischargeForm(f => ({ ...f, discharge_date: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Discharge Notes</label>
                <textarea
                  value={dischargeForm.discharge_notes}
                  onChange={e => setDischargeForm(f => ({ ...f, discharge_notes: e.target.value }))}
                  rows={3}
                  placeholder="Discharge summary, follow-up instructions..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>

              <p className="text-xs text-slate-400">
                The bed will be freed and you will be offered the option to generate an invoice.
              </p>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={discharging}
                  className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 disabled:opacity-50">
                  {discharging ? 'Processing...' : 'Confirm Discharge'}
                </button>
                <button type="button" onClick={() => setShowDischargeModal(false)}
                  className="px-6 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Ward Transfer Modal ────────────────────────────────────────────────── */}
      {showTransferModal && transferTarget && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Ward Transfer</h3>
                <p className="text-sm text-slate-500 mt-0.5">{transferTarget.patient_name}</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-sm text-slate-600">
                Currently: <span className="font-medium">{transferTarget.ward_name || '—'}</span> &nbsp;/&nbsp; Bed <span className="font-medium">{transferTarget.bed_number || '—'}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Ward *</label>
                <select
                  value={transferForm.ward_id}
                  onChange={e => setTransferForm(f => ({ ...f, ward_id: e.target.value, bed_id: '' }))}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">— Select Ward —</option>
                  {wards.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.available_beds ?? '?'} avail.)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Bed *</label>
                <select
                  value={transferForm.bed_id}
                  onChange={e => setTransferForm(f => ({ ...f, bed_id: e.target.value }))}
                  required
                  disabled={!transferForm.ward_id}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
                >
                  <option value="">— Select Bed —</option>
                  {transferBeds.map(b => (
                    <option key={b.id} value={b.id}>Bed {b.bed_number} ({b.bed_type})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={transferring}
                  className="flex-1 py-2.5 bg-yellow-600 text-white rounded-xl font-medium hover:bg-yellow-700 disabled:opacity-50">
                  {transferring ? 'Transferring...' : 'Confirm Transfer'}
                </button>
                <button type="button" onClick={() => setShowTransferModal(false)}
                  className="px-6 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Detail Modal ───────────────────────────────────────────────────────── */}
      {showDetail && detailAdm && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Admission Details</h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{detailAdm.admission_number}</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">

              {/* Status badge */}
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[detailAdm.status] || 'bg-slate-100'}`}>
                  {detailAdm.status?.toUpperCase()}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${detailAdm.admission_type === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                  {detailAdm.admission_type}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  { label: 'Patient',       value: detailAdm.patient_name },
                  { label: 'Phone',         value: detailAdm.patient_phone || '—' },
                  { label: 'Ward',          value: detailAdm.ward_name     || '—' },
                  { label: 'Bed',           value: detailAdm.bed_number    || '—' },
                  { label: 'Doctor',        value: detailAdm.doctor_name   || '—' },
                  { label: 'Admitted',      value: fmtDate(detailAdm.admission_date) },
                  { label: 'Discharged',    value: fmtDate(detailAdm.discharge_date) },
                  { label: 'Days Stayed',   value: daysSince(detailAdm.admission_date) },
                ].map(row => (
                  <div key={row.label}>
                    <p className="text-xs text-slate-400">{row.label}</p>
                    <p className="font-medium text-slate-800">{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Diagnosis */}
              {detailAdm.diagnosis && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Diagnosis</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{detailAdm.diagnosis}</p>
                </div>
              )}

              {/* Notes */}
              {detailAdm.notes && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Treatment Notes</p>
                  <pre className="text-sm text-slate-700 bg-indigo-50 rounded-lg p-3 whitespace-pre-wrap font-sans max-h-44 overflow-y-auto">
                    {detailAdm.notes}
                  </pre>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {detailAdm.status === 'admitted' && (
                  <button
                    onClick={() => { setShowDetail(false); openDischarge(detailAdm) }}
                    className="px-4 py-2 bg-orange-100 text-orange-700 rounded-xl text-sm hover:bg-orange-200"
                  >
                    Discharge
                  </button>
                )}
                <button
                  onClick={() => { setShowDetail(false); openEdit(detailAdm) }}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-sm hover:bg-blue-200"
                >
                  Edit
                </button>
                <button onClick={() => setShowDetail(false)}
                  className="ml-auto px-6 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
