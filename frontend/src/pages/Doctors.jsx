import { useState, useEffect } from 'react'
import api from '../api'
import { isValidName, isValidPhone, isValidEmail, sanitizeInput } from '../utils/validation'

export default function Doctors() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', specialization: '', phone: '', email: '' })

  useEffect(() => { fetchDoctors() }, [])

  const fetchDoctors = async () => {
    try {
      const res = await api.get('/doctors')
      setDoctors(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    // Validation
    if (!form.name || !isValidName(form.name)) {
      setError('Enter a valid doctor name (letters only, min 2 chars)')
      return
    }
    if (form.phone && !isValidPhone(form.phone)) {
      setError('Enter a valid phone number (e.g., 0300-1234567)')
      return
    }
    if (form.email && !isValidEmail(form.email)) {
      setError('Enter a valid email address')
      return
    }

    try {
      await api.post('/doctors', { ...form, name: sanitizeInput(form.name) })
      setForm({ name: '', specialization: '', phone: '', email: '' })
      setShowForm(false)
      fetchDoctors()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add doctor')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Doctors</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {showForm ? 'Cancel' : '+ Add Doctor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Doctor Name *</label>
              <input
                value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
                required placeholder="e.g., Dr. Ahmed Ali"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Specialization</label>
              <select
                value={form.specialization} onChange={(e) => setForm({...form, specialization: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Select</option>
                <option value="General Physician">General Physician</option>
                <option value="Pathologist">Pathologist</option>
                <option value="Cardiologist">Cardiologist</option>
                <option value="Gynecologist">Gynecologist</option>
                <option value="Pediatrician">Pediatrician</option>
                <option value="Surgeon">Surgeon</option>
                <option value="Dermatologist">Dermatologist</option>
                <option value="Orthopedic">Orthopedic</option>
                <option value="ENT">ENT Specialist</option>
                <option value="Neurologist">Neurologist</option>
                <option value="Urologist">Urologist</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})}
                placeholder="e.g., 0300-1234567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})}
                placeholder="e.g., dr.ahmed@hospital.pk"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <button type="submit" className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Save Doctor
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Name</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Specialization</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Phone</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {doctors.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{d.name}</td>
                <td className="px-6 py-4">{d.specialization || '-'}</td>
                <td className="px-6 py-4">{d.phone || '-'}</td>
                <td className="px-6 py-4">{d.email || '-'}</td>
              </tr>
            ))}
            {!loading && doctors.length === 0 && (
              <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">No doctors added yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
