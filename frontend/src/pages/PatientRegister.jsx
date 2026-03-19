import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { isValidPhone, isValidName, isValidMRN, sanitizeInput } from '../utils/validation'

export default function PatientRegister() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    mrn: '', first_name: '', last_name: '', dob: '', gender: '', phone: '', address: '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })

    // Live validation
    const errors = { ...fieldErrors }
    if (name === 'mrn' && value && !isValidMRN(value)) {
      errors.mrn = 'Only letters, numbers, and hyphens allowed'
    } else if (name === 'mrn') { delete errors.mrn }

    if (name === 'first_name' && value && !isValidName(value)) {
      errors.first_name = 'Only letters, spaces, dots allowed (min 2 chars)'
    } else if (name === 'first_name') { delete errors.first_name }

    if (name === 'last_name' && value && !isValidName(value)) {
      errors.last_name = 'Only letters, spaces, dots allowed (min 2 chars)'
    } else if (name === 'last_name') { delete errors.last_name }

    if (name === 'phone' && value && !isValidPhone(value)) {
      errors.phone = 'Enter valid Pakistan number (e.g., 0300-1234567)'
    } else if (name === 'phone') { delete errors.phone }

    setFieldErrors(errors)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Full validation
    if (!isValidMRN(form.mrn)) { setError('Invalid MRN format'); return }
    if (!isValidName(form.first_name)) { setError('Invalid first name — only letters allowed'); return }
    if (!isValidName(form.last_name)) { setError('Invalid last name — only letters allowed'); return }
    if (form.phone && !isValidPhone(form.phone)) { setError('Invalid phone number format'); return }

    setLoading(true)
    try {
      const data = {
        ...form,
        first_name: sanitizeInput(form.first_name),
        last_name: sanitizeInput(form.last_name),
        address: sanitizeInput(form.address),
      }
      if (!data.dob) delete data.dob
      if (!data.gender) delete data.gender

      await api.post('/patients', data)
      navigate('/patients')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to register patient')
    } finally { setLoading(false) }
  }

  const inputClass = (field) =>
    `w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none transition-all ${
      fieldErrors[field] ? 'border-red-400 focus:ring-red-500 bg-red-50/50' : 'border-slate-300 focus:ring-blue-500'
    }`

  return (
    <div className="max-w-2xl animate-fadeIn">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Register New Patient</h2>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm animate-slideDown">⚠️ {error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">MRN *</label>
            <input name="mrn" value={form.mrn} onChange={handleChange} required
              className={inputClass('mrn')} placeholder="e.g., PAT001" maxLength={50} />
            {fieldErrors.mrn && <p className="text-xs text-red-500 mt-1">{fieldErrors.mrn}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange}
              className={inputClass('phone')} placeholder="e.g., 0300-1234567" maxLength={15} />
            {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
            <input name="first_name" value={form.first_name} onChange={handleChange} required
              className={inputClass('first_name')} maxLength={100} />
            {fieldErrors.first_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.first_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
            <input name="last_name" value={form.last_name} onChange={handleChange} required
              className={inputClass('last_name')} maxLength={100} />
            {fieldErrors.last_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.last_name}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
            <input name="dob" type="date" value={form.dob} onChange={handleChange}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
            <select name="gender" value={form.gender} onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">Select</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
          <textarea name="address" value={form.address} onChange={handleChange} rows="2" maxLength={500}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading || Object.keys(fieldErrors).length > 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all">
            {loading ? 'Saving...' : 'Register Patient'}
          </button>
          <button type="button" onClick={() => navigate('/patients')}
            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
        </div>
      </form>
    </div>
  )
}
