import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function Patients() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPatients()
  }, [])

  const fetchPatients = async (query = '') => {
    setLoading(true)
    try {
      const res = await api.get('/patients', { params: { search: query || undefined } })
      setPatients(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchPatients(search)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Patients</h2>
        <Link
          to="/patients/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          + Register Patient
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, MRN, or phone..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
          >
            Search
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">MRN</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Name</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Gender</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Age</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Phone</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/patients/${p.id}`}>
                <td className="px-6 py-4 font-medium text-blue-600">{p.mrn}</td>
                <td className="px-6 py-4">{p.full_name}</td>
                <td className="px-6 py-4">{p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : p.gender}</td>
                <td className="px-6 py-4">{p.age ?? '-'}</td>
                <td className="px-6 py-4">{p.phone || '-'}</td>
                <td className="px-6 py-4 text-slate-500">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {!loading && patients.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                  No patients found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
