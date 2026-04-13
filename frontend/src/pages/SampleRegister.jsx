import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'

export default function SampleRegister() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [panels, setPanels] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const searchRef = useRef(null)

  const [form, setForm] = useState({
    sample_id: '',
    patient_id: '',
    doctor_id: '',
    test_panel: '',
    notes: '',
  })

  useEffect(() => {
    api.get('/doctors').then((r) => setDoctors(r.data)).catch(console.error)
    api.get('/categories/test_panel').then((r) => setPanels(r.data)).catch(() => {
      setPanels([
        { name: 'CBC' }, { name: 'LFT' }, { name: 'RFT' },
        { name: 'Lipid Profile' }, { name: 'Thyroid Profile' },
        { name: 'Blood Sugar' }, { name: 'HbA1c' }, { name: 'Urine R/E' },
      ])
    })
  }, [])

  // Auto-select patient when navigated from OPD (?patient_id=X)
  useEffect(() => {
    const pid = searchParams.get('patient_id')
    if (pid) {
      api.get('/patients', { params: { search: pid } })
        .then(r => {
          const found = r.data.find(p => String(p.id) === String(pid))
          if (found) {
            setSelectedPatient(found)
            setForm(prev => ({ ...prev, patient_id: found.id }))
            setPatientSearch(`${found.mrn} - ${found.full_name}`)
          }
        })
        .catch(() => {})
    }
  }, [])

  // Search patients as user types
  useEffect(() => {
    if (patientSearch.length >= 1) {
      api.get('/patients', { params: { search: patientSearch } })
        .then((r) => { setPatients(r.data); setShowPatientDropdown(true) })
        .catch(console.error)
    } else {
      setShowPatientDropdown(false)
    }
  }, [patientSearch])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowPatientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectPatient = (p) => {
    setSelectedPatient(p)
    setForm({ ...form, patient_id: p.id })
    setPatientSearch(`${p.mrn} - ${p.full_name}`)
    setShowPatientDropdown(false)
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = {
        ...form,
        patient_id: parseInt(form.patient_id),
        doctor_id: form.doctor_id ? parseInt(form.doctor_id) : null,
      }
      await api.post('/samples', data)
      // Auto-complete appointment if we came from one
      const apptId = searchParams.get('appt_id')
      if (apptId) {
        api.put(`/appointments/${apptId}`, { status: 'completed' }).catch(() => {})
      }
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create sample')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-2xl animate-fadeIn">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Register New Sample</h2>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm animate-slideDown">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 card-animate">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sample ID / Barcode *</label>
            <input name="sample_id" value={form.sample_id} onChange={handleChange}
              required placeholder="e.g., SAM002"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Test Panel</label>
            <select name="test_panel" value={form.test_panel} onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all">
              <option value="">Select Panel</option>
              {panels.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Patient Search with Autocomplete */}
          <div ref={searchRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Patient * (type to search)</label>
            <input
              value={patientSearch}
              onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); setForm({...form, patient_id: ''}) }}
              placeholder="Search by name, MRN, or phone..."
              required={!selectedPatient}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            {selectedPatient && (
              <div className="mt-1 text-xs text-green-600 animate-fadeIn">
                Selected: {selectedPatient.full_name} ({selectedPatient.mrn})
              </div>
            )}

            {/* Dropdown */}
            {showPatientDropdown && patients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto animate-slideDown">
                {patients.map((p) => (
                  <div key={p.id} onClick={() => selectPatient(p)}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0">
                    <div className="font-medium text-sm">{p.full_name}</div>
                    <div className="text-xs text-slate-500">MRN: {p.mrn} | {p.gender === 'M' ? 'Male' : 'Female'} | {p.phone || 'No phone'}</div>
                  </div>
                ))}
              </div>
            )}
            {showPatientDropdown && patients.length === 0 && patientSearch.length >= 2 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm text-slate-400 animate-slideDown">
                No patients found. <a href="/patients/new" className="text-blue-600 hover:underline">Register new?</a>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Referring Doctor</label>
            <select name="doctor_id" value={form.doctor_id} onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all">
              <option value="">Select Doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows="2"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="Any special instructions..." />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading || !form.patient_id}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all hover-lift">
            {loading ? 'Creating...' : 'Create Sample'}
          </button>
          <button type="button" onClick={() => navigate('/')}
            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
