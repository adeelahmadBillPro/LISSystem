import { useState, useEffect, useContext, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { ThemeContext } from '../App'
import ModalPortal from '../components/ModalPortal'

const STATUS_CONFIG = {
  pending:    { label: '🌐 Online Request', color: 'bg-orange-100 text-orange-700' },
  scheduled:  { label: 'Scheduled',        color: 'bg-blue-100 text-blue-700' },
  confirmed:  { label: 'Confirmed',        color: 'bg-cyan-100 text-cyan-700' },
  arrived:    { label: '✅ Arrived',        color: 'bg-green-100 text-green-700' },
  completed:  { label: 'Completed',        color: 'bg-slate-100 text-slate-600' },
  cancelled:  { label: 'Cancelled',        color: 'bg-slate-100 text-slate-400' },
  no_show:    { label: 'No Show',          color: 'bg-red-100 text-red-600' },
}

const TYPE_ICONS = {
  consultation: '🩺', follow_up: '🔄', lab: '🧪', radiology: '📡', other: '📋',
}

const EMPTY_FORM = {
  patient_id: '', doctor_id: '', appt_date: new Date().toISOString().slice(0, 10),
  appt_time: '', appt_type: 'consultation', reason: '', notes: '',
}

export default function Appointments() {
  const { darkMode } = useContext(ThemeContext)
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors]   = useState([])
  const [viewDate, setViewDate] = useState(new Date().toISOString().slice(0, 10))
  const [statusFilter, setStatusFilter] = useState('')
  const [doctorFilter, setDoctorFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId]     = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [patientSearch, setPatientSearch]         = useState('')
  const [patientSuggestions, setPatientSuggestions] = useState([])

  useEffect(() => {
    api.get('/doctors').then(r => setDoctors(r.data)).catch(() => {})
    api.get('/patients', { params: { search: '' } }).then(r => setPatients(r.data)).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { date: viewDate }
      if (statusFilter) params.status    = statusFilter
      if (doctorFilter) params.doctor_id = doctorFilter
      const r = await api.get('/appointments', { params })
      setAppointments(r.data)
    } catch {}
    finally { setLoading(false) }
  }, [viewDate, statusFilter, doctorFilter])

  useEffect(() => { load() }, [load])

  // Patient search
  useEffect(() => {
    if (patientSearch.length >= 1) {
      api.get('/patients', { params: { search: patientSearch } })
        .then(r => setPatientSuggestions(r.data))
        .catch(() => {})
    } else {
      setPatientSuggestions([])
    }
  }, [patientSearch])

  const selectPatient = (p) => {
    setForm(prev => ({ ...prev, patient_id: p.id }))
    setPatientSearch(`${p.mrn} - ${p.full_name}`)
    setPatientSuggestions([])
  }

  const openNew = () => {
    setForm({ ...EMPTY_FORM, appt_date: viewDate })
    setEditId(null)
    setPatientSearch('')
    setShowModal(true)
  }

  const openEdit = (a) => {
    setForm({
      patient_id: a.patient_id,
      doctor_id:  a.doctor_id  || '',
      appt_date:  a.appt_date,
      appt_time:  a.appt_time  || '',
      appt_type:  a.appt_type  || 'consultation',
      reason:     a.reason     || '',
      notes:      a.notes      || '',
    })
    setPatientSearch(`${a.patient_mrn} - ${a.patient_name}`)
    setEditId(a.id)
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.patient_id) { alert('Select a patient'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        patient_id: Number(form.patient_id),
        doctor_id:  form.doctor_id ? Number(form.doctor_id) : null,
      }
      if (editId) {
        await api.put(`/appointments/${editId}`, payload)
      } else {
        await api.post('/appointments', payload)
      }
      setShowModal(false)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  const quickStatus = async (id, status) => {
    await api.put(`/appointments/${id}`, { status })
    load()
  }

  // Mark patient as arrived → show action panel
  const handleArrive = async (id) => {
    await api.put(`/appointments/${id}`, { status: 'arrived' })
    load()
  }

  // Go to OPD with patient pre-selected and appointment context
  const handleGoOPD = (patientId, apptId) => {
    navigate(`/opd?patient_id=${patientId}${apptId ? `&appt_id=${apptId}` : ''}`)
  }

  // Go to Sample Registration with patient pre-selected, auto-complete appointment after save
  const handleGoLab = (patientId, apptId) => {
    navigate(`/samples/new?patient_id=${patientId}${apptId ? `&appt_id=${apptId}` : ''}`)
  }

  // Admit to IPD with patient pre-selected
  const handleGoIPD = (patientId, apptId) => {
    navigate(`/ipd?patient_id=${patientId}&action=admit${apptId ? `&appt_id=${apptId}` : ''}`)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this appointment?')) return
    await api.delete(`/appointments/${id}`)
    load()
  }

  const handlePrint = () => window.print()

  const card = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'

  // Time-slot grouping for the day view
  const hours = Array.from({ length: 14 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`)
  const byHour = {}
  appointments.forEach(a => {
    const h = a.appt_time ? a.appt_time.slice(0, 2) + ':00' : 'Unscheduled'
    if (!byHour[h]) byHour[h] = []
    byHour[h].push(a)
  })

  const pendingOnline = appointments.filter(a => a.status === 'pending' && a.notes?.includes('Online booking'))

  return (
    <div className="animate-fadeIn">
      {/* Online booking alert banner */}
      {pendingOnline.length > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-orange-50 border border-orange-200 text-orange-800 rounded-2xl px-4 py-3 print:hidden">
          <span className="text-xl">🌐</span>
          <div className="flex-1">
            <span className="font-bold">{pendingOnline.length} online appointment request{pendingOnline.length > 1 ? 's' : ''}</span>
            <span className="text-sm ml-2">— website se aayi hain. Confirm ya cancel karein.</span>
          </div>
          <button onClick={() => {}} className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700">
            View All
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Appointments</h2>
          <p className="text-sm text-slate-500">Schedule & manage patient appointments</p>
        </div>
        {/* Action buttons — hidden in print */}
        <div className="flex gap-2 items-center flex-wrap print:hidden">
          <input
            type="date"
            value={viewDate}
            onChange={e => setViewDate(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm hover:bg-slate-800 flex items-center gap-2"
          >
            🖨️ Print
          </button>
          <button
            onClick={openNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 flex items-center gap-2"
          >
            + New Appointment
          </button>
        </div>
        {/* Print-only date header */}
        <div className="hidden print:block text-slate-600 text-sm font-medium">
          {new Date(viewDate + 'T00:00:00').toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Summary chips + doctor filter — hidden in print */}
      <div className="flex gap-2 flex-wrap mb-5 print:hidden">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const cnt = appointments.filter(a => a.status === key).length
          if (cnt === 0) return null
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${statusFilter === key ? 'ring-2 ring-offset-1 ring-blue-500' : ''} ${cfg.color}`}
            >
              {cfg.label}: {cnt}
            </button>
          )
        })}
        <div className="ml-auto">
          <select
            value={doctorFilter}
            onChange={e => setDoctorFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none"
          >
            <option value="">All Doctors</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading...</div>
      ) : appointments.length === 0 ? (
        <div className={`rounded-2xl border p-16 text-center ${card}`}>
          <div className="text-4xl mb-3">📅</div>
          <p className="text-slate-500">No appointments for {viewDate}</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm print:hidden">
            Schedule First Appointment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Day Timeline */}
          <div className={`lg:col-span-2 rounded-2xl border shadow-sm overflow-hidden ${card}`}>
            <div className={`px-5 py-3 border-b font-semibold text-sm ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              📅 {new Date(viewDate + 'T00:00:00').toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              <span className="ml-2 text-slate-400 font-normal">{appointments.length} appointments</span>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700">
              {/* Unscheduled first */}
              {(byHour['Unscheduled'] || []).map(a => (
                <ApptRow
                  key={a.id}
                  a={a}
                  darkMode={darkMode}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onStatus={quickStatus}
                  onArrive={handleArrive}
                  onGoOPD={handleGoOPD}
                  onGoLab={handleGoLab}
                  onGoIPD={handleGoIPD}
                />
              ))}
              {/* Time slots */}
              {hours.map(h =>
                (byHour[h] || []).map(a => (
                  <ApptRow
                    key={a.id}
                    a={a}
                    darkMode={darkMode}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onStatus={quickStatus}
                    onArrive={handleArrive}
                    onGoOPD={handleGoOPD}
                    onGoLab={handleGoLab}
                    onGoIPD={handleGoIPD}
                  />
                ))
              )}
            </div>
          </div>

          {/* Stats panel */}
          <div className="space-y-4">
            <div className={`rounded-2xl border p-5 shadow-sm ${card}`}>
              <h3 className="font-semibold text-slate-700 dark:text-white mb-4">Today's Summary</h3>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const cnt = appointments.filter(a => a.status === key).length
                if (cnt === 0) return null
                return (
                  <div key={key} className="flex items-center justify-between py-1.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{cnt}</span>
                  </div>
                )
              })}
            </div>
            <div className={`rounded-2xl border p-5 shadow-sm ${card}`}>
              <h3 className="font-semibold text-slate-700 dark:text-white mb-3">By Type</h3>
              {Object.entries(TYPE_ICONS).map(([type, icon]) => {
                const cnt = appointments.filter(a => a.appt_type === type).length
                if (cnt === 0) return null
                return (
                  <div key={type} className="flex items-center gap-2 py-1.5 text-sm">
                    <span>{icon}</span>
                    <span className="capitalize text-slate-600 dark:text-slate-300 flex-1">
                      {type.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{cnt}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal — hidden in print */}
      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-800">
                {editId ? 'Edit Appointment' : 'New Appointment'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Patient */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Patient *</label>
                <input
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Search by name / MRN / phone…"
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                {patientSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {patientSuggestions.map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between"
                      >
                        <span className="font-medium">{p.full_name}</span>
                        <span className="text-slate-400 text-xs">{p.mrn} · {p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Doctor</label>
                  <select
                    value={form.doctor_id}
                    onChange={e => setForm({ ...form, doctor_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— No Doctor —</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                  <select
                    value={form.appt_type}
                    onChange={e => setForm({ ...form, appt_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(TYPE_ICONS).map(([t, i]) => (
                      <option key={t} value={t}>{i} {t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.appt_date}
                    onChange={e => setForm({ ...form, appt_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={form.appt_time}
                    onChange={e => setForm({ ...form, appt_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason / Chief Complaint</label>
                <input
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Fever, follow-up CBC, etc."
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editId ? 'Update' : 'Book Appointment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border rounded-xl text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:block  { display: block  !important; }
        }
      `}</style>
    </div>
  )
}

function ApptRow({ a, darkMode, onEdit, onDelete, onStatus, onArrive, onGoOPD, onGoLab, onGoIPD }) {
  const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.scheduled
  const isOnline  = a.notes?.includes('Online booking')
  const isArrived = a.status === 'arrived'
  const canArrive = ['pending', 'scheduled', 'confirmed'].includes(a.status)

  return (
    <div className={`px-5 py-3 border-b last:border-0 ${
      isOnline && a.status === 'pending'
        ? darkMode ? 'bg-orange-900/20' : 'bg-orange-50'
        : isArrived
        ? darkMode ? 'bg-green-900/20' : 'bg-green-50'
        : darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
    }`}>
      {/* Main row */}
      <div className="flex items-center gap-3">
        <div className="text-slate-400 text-xs w-12 flex-shrink-0 font-mono">{a.appt_time || '—'}</div>
        <span className="text-lg flex-shrink-0">{TYPE_ICONS[a.appt_type] || '📋'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-800 dark:text-white">{a.patient_name}</span>
            {isOnline && <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">🌐 Online</span>}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {a.patient_mrn} · {a.patient_phone}
            {a.doctor_name && <> · <span className="text-blue-500">Dr. {a.doctor_name}</span></>}
          </div>
          {a.reason && <div className="text-xs text-slate-500 truncate mt-0.5">💬 {a.reason}</div>}
        </div>

        {/* Status badge */}
        <span className={`px-2 py-1 rounded-lg text-xs font-semibold flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0 print:hidden">
          {/* Patient Arrived button — most important action */}
          {canArrive && (
            <button
              onClick={() => onArrive(a.id)}
              className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors whitespace-nowrap"
              title="Mark patient as arrived"
            >
              ✅ Arrived
            </button>
          )}
          <button onClick={() => onEdit(a)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-lg text-xs">✏️</button>
          <button onClick={() => onDelete(a.id)} className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-slate-600 rounded-lg text-xs">🗑️</button>
        </div>
      </div>

      {/* Arrival action panel — shown when patient is arrived */}
      {isArrived && (
        <div className="mt-3 ml-16 print:hidden">
          <div className="text-xs text-green-700 dark:text-green-400 font-bold mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            Patient yahan hai — aage kya karna hai?
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onGoOPD(a.patient_id, a.id)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              🏥 OPD Visit Kholo
            </button>
            <button
              onClick={() => onGoLab(a.patient_id, a.id)}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-colors shadow-sm"
            >
              🧪 Lab Sample Register
            </button>
            <button
              onClick={() => onGoIPD(a.patient_id, a.id)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
            >
              🛏️ IPD Admit Karo
            </button>
            <button
              onClick={() => onStatus(a.id, 'completed')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-500 text-white rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors shadow-sm"
            >
              ✓ Complete
            </button>
          </div>
          <div className="flex gap-3 mt-2 text-[10px] text-slate-400">
            <span>🏥 Consultation / OPD visit ke liye</span>
            <span>🧪 Lab test ke liye</span>
            <span>🛏️ Admit karna ho toh</span>
          </div>
        </div>
      )}

      {/* Print-only badge */}
      <span className={`px-2 py-0.5 rounded text-xs font-medium hidden print:inline-block ${cfg.color}`}>{cfg.label}</span>
    </div>
  )
}
