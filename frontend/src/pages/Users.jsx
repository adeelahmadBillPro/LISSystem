import { useState, useEffect } from 'react'
import api from '../api'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'technician' })

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users')
      setUsers(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      await api.post('/auth/register', form)
      setSuccess(`User "${form.username}" created successfully`)
      setForm({ username: '', password: '', full_name: '', role: 'technician' })
      setShowForm(false)
      fetchUsers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user')
    }
  }

  const roleColors = {
    admin: 'bg-red-100 text-red-700',
    technician: 'bg-blue-100 text-blue-700',
    doctor: 'bg-green-100 text-green-700',
    receptionist: 'bg-purple-100 text-purple-700',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
              <input
                value={form.full_name} onChange={(e) => setForm({...form, full_name: e.target.value})}
                required placeholder="e.g., Muhammad Ali"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
              <select
                value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="receptionist">Receptionist</option>
                <option value="technician">Lab Technician</option>
                <option value="doctor">Doctor / Pathologist</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
              <input
                value={form.username} onChange={(e) => setForm({...form, username: e.target.value})}
                required placeholder="e.g., mali"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
              <input
                type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})}
                required minLength={6} placeholder="Min 6 characters"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <button type="submit" className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Create User
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Name</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Username</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Role</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Status</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Last Login</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={`hover:bg-slate-50 ${!u.is_active ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4 font-medium">{u.full_name}</td>
                <td className="px-6 py-4">{u.username}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[u.role] || ''}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                </td>
                <td className="px-6 py-4">
                  {u.username !== 'admin' && (
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await api.put(`/users/${u.id}/toggle`)
                            fetchUsers()
                            setSuccess(`${u.full_name} ${u.is_active ? 'disabled' : 'enabled'}`)
                          } catch (err) { setError('Failed to update') }
                        }}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete user "${u.username}"?`)) return
                          try {
                            await api.delete(`/users/${u.id}`)
                            fetchUsers()
                            setSuccess(`${u.username} deleted`)
                          } catch (err) { setError(err.response?.data?.detail || 'Failed') }
                        }}
                        className="px-3 py-1 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
