import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'
import PasswordInput from '../components/PasswordInput'
import { getPasswordStrength, isValidEmail, isValidPhone, isValidName, isValidUsername } from '../utils/validation'

export default function Signup() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    role: 'receptionist',
    lab_code: '',
  })

  const reserved = ['admin', 'administrator', 'root', 'superadmin', 'system', 'sysadmin', 'owner', 'master']

  const handleChange = (e) => {
    const updated = { ...form, [e.target.name]: e.target.value }
    setForm(updated)

    // Live validation
    if (e.target.name === 'username') {
      const val = e.target.value.toLowerCase().trim()
      if (reserved.includes(val)) {
        setError('This username is reserved and cannot be used')
      } else if (val && !/^[a-zA-Z0-9_]+$/.test(val)) {
        setError('Username can only contain letters, numbers, and underscores')
      } else if (val && val.length < 3) {
        setError('Username must be at least 3 characters')
      } else {
        setError('')
      }
    }
    if (e.target.name === 'confirm_password' || e.target.name === 'password') {
      if (e.target.name === 'confirm_password' && updated.password && e.target.value && updated.password !== e.target.value) {
        setError('Passwords do not match')
      } else if (e.target.name === 'password' && updated.confirm_password && e.target.value !== updated.confirm_password) {
        setError('Passwords do not match')
      } else {
        setError('')
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validation
    const reserved = ['admin', 'administrator', 'root', 'superadmin', 'system', 'sysadmin', 'owner', 'master']
    if (reserved.includes(form.username.toLowerCase())) {
      setError('This username is reserved and cannot be used')
      return
    }
    if (form.username.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      setError('Username can only contain letters, numbers, and underscores')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match')
      return
    }
    if (!isValidName(form.full_name)) {
      setError('Enter a valid name (letters only, min 2 chars)')
      return
    }
    if (form.email && !isValidEmail(form.email)) {
      setError('Enter a valid email address')
      return
    }
    if (form.phone && !isValidPhone(form.phone)) {
      setError('Enter a valid phone number (e.g., 0300-1234567)')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/signup', {
        full_name: form.full_name,
        username: form.username,
        password: form.password,
        role: form.role,
        lab_code: form.lab_code,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md text-center animate-scaleIn">
          <div className="text-6xl mb-4 animate-bounce">✅</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Account Created!</h2>
          <p className="text-slate-500 mb-6">
            Your account has been created successfully. Please contact your lab administrator to activate your account.
          </p>
          <Link to="/login"
            className="inline-block px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all">
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden p-3 sm:p-4">
      {/* Background — desktop only */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse-soft"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-soft" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Card — max height with internal scroll so button always visible */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 animate-scaleIn flex flex-col"
           style={{ maxHeight: 'calc(100vh - 1.5rem)' }}>

        {/* Fixed header */}
        <div className="px-8 pt-7 pb-4 border-b border-slate-100 shrink-0">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-green-600/30">
              <span className="text-xl">📝</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Create Account</h2>
            <p className="text-slate-500 text-xs mt-0.5">Register for the LIS system</p>
          </div>
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl mt-3 text-sm flex items-center gap-2 animate-slideDown">
              <span>⚠️</span> {error}
            </div>
          )}
        </div>

        {/* Scrollable fields */}
        <div className="overflow-y-auto flex-1 px-8 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">👤</span>
              <input name="full_name" value={form.full_name} onChange={handleChange} required
                placeholder="e.g., Muhammad Ali"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                <input name="username" value={form.username} onChange={handleChange} required
                  placeholder="e.g., mali" minLength={3}
                  className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 outline-none transition-all bg-slate-50/50 ${
                    reserved.includes(form.username.toLowerCase().trim())
                      ? 'border-red-400 focus:ring-red-500 bg-red-50/50'
                      : 'border-slate-200 focus:ring-blue-500'
                  }`} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
              <select name="role" value={form.role} onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50/50">
                <option value="receptionist">Receptionist</option>
                <option value="technician">Lab Technician</option>
                <option value="doctor">Doctor / Pathologist</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📧</span>
                <input type="email" name="email" value={form.email} onChange={handleChange}
                  placeholder="e.g., ali@lab.pk"
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50/50" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📱</span>
                <input name="phone" value={form.phone} onChange={handleChange}
                  placeholder="e.g., 0300-1234567"
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50/50" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
              <PasswordInput name="password" value={form.password} onChange={handleChange} placeholder="Min 6 chars" minLength={6} />
              {form.password && (
                <div className="mt-1.5">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= getPasswordStrength(form.password).score ? getPasswordStrength(form.password).color : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">{getPasswordStrength(form.password).label}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password *</label>
              <PasswordInput name="confirm_password" value={form.confirm_password} onChange={handleChange} placeholder="Repeat password" />
              {form.confirm_password && form.password !== form.confirm_password && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
              {form.confirm_password && form.password === form.confirm_password && (
                <p className="text-xs text-green-500 mt-1">Passwords match</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lab Registration Code (optional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🏢</span>
              <input name="lab_code" value={form.lab_code} onChange={handleChange}
                placeholder="Enter code if provided by your lab"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50/50" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Ask your lab admin for the registration code</p>
          </div>

        </form>
        </div>{/* end scrollable */}

        {/* Fixed footer — always visible, never hidden */}
        <div className="px-8 py-5 border-t border-slate-100 bg-white/80 rounded-b-3xl shrink-0">
          <button type="submit" form="signup-form" disabled={loading} onClick={handleSubmit}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 shadow-lg shadow-green-600/30 active:scale-[0.98]">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Creating Account...
              </span>
            ) : '✅ Create Account'}
          </button>
          <p className="text-xs text-center text-slate-400 mt-3">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">Sign In</Link>
          </p>
        </div>

      </div>{/* end card */}
    </div>
  )
}
