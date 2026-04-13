import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import ModalPortal from '../components/ModalPortal'

const ANESTHESIA_TYPES = ['General', 'Spinal', 'Epidural', 'Local', 'Regional', 'IV Sedation']
const STATUS_COLORS = {
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
  postponed:   'bg-orange-100 text-orange-700',
}
const THEATER_STATUS = {
  available:   'bg-green-100 text-green-700 border-green-300',
  occupied:    'bg-red-100 text-red-700 border-red-300',
  maintenance: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  cleaning:    'bg-blue-100 text-blue-700 border-blue-300',
}

const PREOP_CHECKLIST_LABELS = {
  consent_signed:           'Consent form signed by patient / guardian',
  fasting_confirmed:        'Fasting confirmed (NPO status)',
  blood_group_checked:      'Blood group checked & verified',
  anesthesia_assessment:    'Anesthesia pre-assessment done',
  iv_access:                'IV access secured',
  site_marked:              'Surgical site marked',
}

const DEFAULT_PREOP = {
  consent_signed: false,
  fasting_confirmed: false,
  blood_group_checked: false,
  anesthesia_assessment: false,
  iv_access: false,
  site_marked: false,
}

export default function OT() {
  const navigate = useNavigate()
  const [theaters, setTheaters]   = useState([])
  const [surgeries, setSurgeries] = useState([])
  const [stats, setStats]         = useState({})
  const [patients, setPatients]   = useState([])
  const [doctors, setDoctors]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter]     = useState(new Date().toISOString().slice(0, 10))
  const [showSurgModal, setShowSurgModal]     = useState(false)
  const [showTheaterModal, setShowTheaterModal] = useState(false)
  const [showPostOpModal, setShowPostOpModal]   = useState(false)
  const [editSurg, setEditSurg]       = useState(null)
  const [editTheater, setEditTheater] = useState(null)
  const [postOpSurg, setPostOpSurg]   = useState(null)
  const [saving, setSaving]           = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [surgForm, setSurgForm] = useState({
    patient_id: '', surgeon_id: '', theater_id: '', procedure_name: '',
    scheduled_at: '', anesthesiologist: '', anesthesia_type: 'General',
    notes: '', status: 'scheduled',
  })
  const [preOpChecklist, setPreOpChecklist] = useState({ ...DEFAULT_PREOP })
  const [theaterForm, setTheaterForm] = useState({ name: '', ot_type: 'general', status: 'available' })
  const [postOpNote, setPostOpNote]   = useState('')

  // ── Loaders ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, sRes, stRes] = await Promise.all([
        api.get('/ot/theaters'),
        api.get('/ot/surgeries', {
          params: {
            status: statusFilter || undefined,
            search: search || undefined,
            date_filter: dateFilter || undefined,
          },
        }),
        api.get('/ot/stats'),
      ])
      setTheaters(tRes.data)
      setSurgeries(sRes.data)
      setStats(stRes.data)
    } catch {}
    setLoading(false)
  }, [statusFilter, search, dateFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/doctors').then(r => setDoctors(r.data)).catch(() => {})
  }, [])

  const searchPatients = async (q) => {
    if (q.length < 2) { setPatients([]); return }
    try {
      const r = await api.get('/patients', { params: { search: q, limit: 10 } })
      setPatients(r.data)
    } catch {}
  }

  // ── Surgery CRUD ─────────────────────────────────────────────────────────
  const openNewSurg = () => {
    setEditSurg(null)
    setSurgForm({
      patient_id: '', surgeon_id: '', theater_id: '', procedure_name: '',
      scheduled_at: '', anesthesiologist: '', anesthesia_type: 'General',
      notes: '', status: 'scheduled',
    })
    setPreOpChecklist({ ...DEFAULT_PREOP })
    setPatientSearch('')
    setPatients([])
    setShowSurgModal(true)
  }

  const openEditSurg = (s) => {
    setEditSurg(s)
    setSurgForm({
      patient_id: s.patient_id,
      surgeon_id: s.surgeon_id || '',
      theater_id: s.theater_id || '',
      procedure_name: s.procedure_name,
      anesthesiologist: s.anesthesiologist || '',
      anesthesia_type: s.anesthesia_type || 'General',
      notes: s.notes || '',
      status: s.status,
      scheduled_at: s.scheduled_at ? s.scheduled_at.slice(0, 16) : '',
    })
    // Restore checklist if stored in notes as JSON prefix (graceful fallback)
    setPreOpChecklist(s.preop_checklist || { ...DEFAULT_PREOP })
    setPatientSearch(s.patient_name)
    setShowSurgModal(true)
  }

  const handleSaveSurg = async () => {
    if (!surgForm.patient_id) { alert('Please select a patient'); return }
    if (!surgForm.procedure_name.trim()) { alert('Procedure name is required'); return }
    setSaving(true)
    try {
      const payload = {
        ...surgForm,
        surgeon_id: surgForm.surgeon_id || null,
        theater_id: surgForm.theater_id || null,
        // Embed pre-op checklist summary into notes if not empty
        notes: surgForm.notes,
        preop_checklist: preOpChecklist,
      }
      if (editSurg) {
        await api.put(`/ot/surgeries/${editSurg.id}`, payload)
      } else {
        await api.post('/ot/surgeries', payload)
      }
      setShowSurgModal(false)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this surgery record?')) return
    try {
      await api.delete(`/ot/surgeries/${id}`)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed') }
  }

  // ── Theater CRUD ─────────────────────────────────────────────────────────
  const handleSaveTheater = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editTheater) {
        await api.put(`/ot/theaters/${editTheater.id}`, theaterForm)
      } else {
        await api.post('/ot/theaters', theaterForm)
      }
      setShowTheaterModal(false)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  const handleDeleteTheater = async (t) => {
    if (!confirm(`Deactivate ${t.name}?`)) return
    try {
      await api.delete(`/ot/theaters/${t.id}`)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed') }
  }

  const quickTheaterStatus = async (t, status) => {
    try {
      await api.put(`/ot/theaters/${t.id}`, { status })
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Update failed') }
  }

  // ── Surgery status ────────────────────────────────────────────────────────
  const quickStatus = async (s, status) => {
    try {
      const payload = { status }
      if (status === 'in_progress') payload.started_at   = new Date().toISOString()
      if (status === 'completed')   payload.completed_at = new Date().toISOString()
      await api.put(`/ot/surgeries/${s.id}`, payload)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Update failed') }
  }

  // ── Post-op notes ─────────────────────────────────────────────────────────
  const openPostOp = (s) => {
    setPostOpSurg(s)
    setPostOpNote(s.post_op_notes || '')
    setShowPostOpModal(true)
  }

  const handleSavePostOp = async () => {
    try {
      await api.put(`/ot/surgeries/${postOpSurg.id}`, { post_op_notes: postOpNote })
      setShowPostOpModal(false)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Save failed') }
  }

  // ── Pre-op checklist helpers ──────────────────────────────────────────────
  const checkedCount = Object.values(preOpChecklist).filter(Boolean).length
  const totalChecks  = Object.keys(PREOP_CHECKLIST_LABELS).length
  const allChecked   = checkedCount === totalChecks

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fadeIn space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Operation Theater (OT)</h2>
          <p className="text-sm text-slate-500 mt-0.5">Surgery scheduling, theater management and post-op notes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setEditTheater(null)
              setTheaterForm({ name: '', ot_type: 'general', status: 'available' })
              setShowTheaterModal(true)
            }}
            className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm hover:bg-slate-200">
            🏥 Manage OTs
          </button>
          <button onClick={openNewSurg}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            ➕ Schedule Surgery
          </button>
        </div>
      </div>

      {/* Theater Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {theaters.map(t => (
          <div key={t.id} className={`border rounded-xl p-3 sm:p-4 ${THEATER_STATUS[t.status] || 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm sm:text-base truncate">{t.name}</span>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => {
                    setEditTheater(t)
                    setTheaterForm({ name: t.name, ot_type: t.ot_type, status: t.status })
                    setShowTheaterModal(true)
                  }}
                  className="text-xs opacity-60 hover:opacity-100" title="Edit">✏️</button>
                <button onClick={() => handleDeleteTheater(t)} className="text-xs opacity-60 hover:opacity-100" title="Deactivate">🗑️</button>
              </div>
            </div>
            <div className="text-xs opacity-75 mb-2 capitalize">{t.ot_type}</div>
            {/* Quick status buttons */}
            <div className="flex flex-wrap gap-1 mb-1">
              {Object.keys(THEATER_STATUS).map(st => (
                <button key={st} onClick={() => t.status !== st && quickTheaterStatus(t, st)}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-all ${t.status === st ? 'bg-white/60 ring-1 ring-current' : 'opacity-50 hover:opacity-80'}`}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
            <div className="text-[10px] mt-1 opacity-70">Today: {t.today_surgeries} surgeries</div>
          </div>
        ))}
        {theaters.length === 0 && (
          <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center text-slate-400 text-sm col-span-2">
            No OTs configured. Add one above.
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Today's Surgeries", value: stats.today_scheduled || 0, icon: '🔪', color: 'bg-blue-50 border-blue-200' },
          { label: 'In Progress', value: stats.in_progress || 0, icon: '⚕️', color: 'bg-yellow-50 border-yellow-200' },
          { label: 'Completed Today', value: stats.completed_today || 0, icon: '✅', color: 'bg-green-50 border-green-200' },
          { label: 'Available OTs', value: stats.available_theaters || 0, icon: '🏥', color: 'bg-purple-50 border-purple-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-3 sm:p-4 ${s.color}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-800">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 sm:p-4 flex flex-wrap gap-3">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <input placeholder="Search patient / procedure..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[160px]" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none">
          <option value="">All Status</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button onClick={load} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">🔄</button>
      </div>

      {/* Surgery Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : surgeries.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="text-4xl mb-3">🏥</div>
            <p>No surgeries found for {dateFilter}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-800 text-white text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Surgery #</th>
                  <th className="text-left px-4 py-3">Patient</th>
                  <th className="text-left px-4 py-3">Procedure</th>
                  <th className="text-left px-4 py-3">Surgeon</th>
                  <th className="text-left px-4 py-3">OT</th>
                  <th className="text-left px-4 py-3">Scheduled</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {surgeries.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.surgery_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.patient_name}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate" title={s.procedure_name}>{s.procedure_name}</td>
                    <td className="px-4 py-3 text-slate-600">{s.surgeon_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.theater_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {s.scheduled_at
                        ? new Date(s.scheduled_at).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select value={s.status} onChange={e => quickStatus(s, e.target.value)}
                        className={`px-2 py-1 rounded text-xs font-medium border-0 outline-none cursor-pointer ${STATUS_COLORS[s.status] || 'bg-slate-100'}`}>
                        {Object.keys(STATUS_COLORS).map(st => (
                          <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1).replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => openPostOp(s)}
                          className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200">
                          Post-Op
                        </button>
                        {s.patient_id && (
                          <button
                            onClick={() => navigate(`/ipd?patient_id=${s.patient_id}&action=admit`)}
                            className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200 whitespace-nowrap"
                            title="Admit this patient to IPD post-surgery">
                            🛏️ Admit IPD
                          </button>
                        )}
                        <button onClick={() => openEditSurg(s)}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(s.id)}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Surgery Modal ── */}
      {showSurgModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{ maxHeight: '93vh' }}>
            {/* Fixed header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-slate-800">{editSurg ? 'Edit Surgery' : 'Schedule Surgery'}</h3>
              <button onClick={() => setShowSurgModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* ── Patient ── */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Patient *</label>
                {editSurg ? (
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm">{editSurg.patient_name}</div>
                ) : (
                  <div className="relative">
                    <input
                      value={patientSearch}
                      onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value) }}
                      placeholder="Search patient by name..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    {patients.length > 0 && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-36 overflow-y-auto">
                        {patients.map(p => (
                          <div key={p.id}
                            onClick={() => {
                              setSurgForm(f => ({ ...f, patient_id: p.id }))
                              setPatientSearch(`${p.first_name} ${p.last_name}`)
                              setPatients([])
                            }}
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

              {/* ── Procedure ── */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Procedure Name *</label>
                <input
                  value={surgForm.procedure_name}
                  onChange={e => setSurgForm(f => ({ ...f, procedure_name: e.target.value }))}
                  placeholder="e.g. Appendectomy, Cholecystectomy"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* ── Surgeon + OT ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Surgeon</label>
                  <select value={surgForm.surgeon_id} onChange={e => setSurgForm(f => ({ ...f, surgeon_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select Surgeon —</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Operation Theater</label>
                  <select value={surgForm.theater_id} onChange={e => setSurgForm(f => ({ ...f, theater_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select OT —</option>
                    {theaters.map(t => <option key={t.id} value={t.id}>{t.name} ({t.status})</option>)}
                  </select>
                </div>
              </div>

              {/* ── Date/Time + Status ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Scheduled Date & Time</label>
                  <input type="datetime-local" value={surgForm.scheduled_at}
                    onChange={e => setSurgForm(f => ({ ...f, scheduled_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select value={surgForm.status} onChange={e => setSurgForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.keys(STATUS_COLORS).map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Anesthesia ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Anesthesiologist</label>
                  <input value={surgForm.anesthesiologist}
                    onChange={e => setSurgForm(f => ({ ...f, anesthesiologist: e.target.value }))}
                    placeholder="Dr. Name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Anesthesia Type</label>
                  <select value={surgForm.anesthesia_type}
                    onChange={e => setSurgForm(f => ({ ...f, anesthesia_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    {ANESTHESIA_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Notes ── */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea value={surgForm.notes} onChange={e => setSurgForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Pre-op notes, special instructions..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {/* ── Pre-Op Checklist ── */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">Pre-Op Checklist</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${allChecked ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {checkedCount}/{totalChecks}
                    </span>
                  </div>
                  {allChecked && <span className="text-xs text-green-600 font-medium">✓ All clear</span>}
                </div>
                <div className="divide-y divide-slate-50">
                  {Object.entries(PREOP_CHECKLIST_LABELS).map(([key, label]) => (
                    <label key={key}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-slate-50 ${preOpChecklist[key] ? 'bg-green-50/40' : ''}`}>
                      <input
                        type="checkbox"
                        checked={!!preOpChecklist[key]}
                        onChange={e => setPreOpChecklist(c => ({ ...c, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded accent-green-600 flex-shrink-0" />
                      <span className={`text-sm ${preOpChecklist[key] ? 'text-green-700 line-through decoration-green-400' : 'text-slate-700'}`}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
                {!allChecked && (
                  <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-100">
                    <p className="text-xs text-yellow-700">Complete all checklist items before proceeding to OT.</p>
                  </div>
                )}
              </div>

            </div>

            {/* Fixed footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex gap-3 flex-shrink-0">
              <button type="button" onClick={handleSaveSurg} disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editSurg ? 'Update Surgery' : 'Schedule Surgery'}
              </button>
              <button type="button" onClick={() => setShowSurgModal(false)}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Theater Modal ── */}
      {showTheaterModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editTheater ? 'Edit Theater' : 'Add Operation Theater'}</h3>
              <button onClick={() => setShowTheaterModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSaveTheater} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input value={theaterForm.name} onChange={e => setTheaterForm(f => ({ ...f, name: e.target.value }))}
                  required placeholder="e.g. OT-1, OT-2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select value={theaterForm.ot_type} onChange={e => setTheaterForm(f => ({ ...f, ot_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  {['general', 'cardiac', 'ortho', 'neuro', 'eye', 'ent', 'gynaecology'].map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={theaterForm.status} onChange={e => setTheaterForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.keys(THEATER_STATUS).map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : editTheater ? 'Update' : 'Add Theater'}
                </button>
                <button type="button" onClick={() => setShowTheaterModal(false)}
                  className="px-5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Post-Op Notes Modal ── */}
      {showPostOpModal && postOpSurg && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Post-Operative Notes</h3>
                <p className="text-xs text-slate-500 mt-0.5">{postOpSurg.surgery_number} — {postOpSurg.patient_name}</p>
              </div>
              <button onClick={() => setShowPostOpModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {postOpSurg.procedure_name && (
                <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600">
                  <span className="font-medium">Procedure:</span> {postOpSurg.procedure_name}
                  {postOpSurg.surgeon_name && <span className="ml-3 text-slate-400">Surgeon: {postOpSurg.surgeon_name}</span>}
                </div>
              )}
              <textarea
                value={postOpNote} onChange={e => setPostOpNote(e.target.value)}
                rows={6}
                placeholder="Enter post-operative observations, complications, patient recovery notes, discharge instructions..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <div className="flex gap-3">
                <button onClick={handleSavePostOp}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700">
                  💾 Save Notes
                </button>
                <button onClick={() => setShowPostOpModal(false)}
                  className="px-5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
