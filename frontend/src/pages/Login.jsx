import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'
import PasswordInput from '../components/PasswordInput'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formData = new URLSearchParams()
      formData.append('username', username)
      formData.append('password', password)

      const res = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('user', JSON.stringify({
        full_name: res.data.full_name,
        role: res.data.role,
      }))
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden">
      {/* Background shapes — hidden on mobile to prevent visual noise */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse-soft"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-soft" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl"></div>
      </div>

      {/* Left side - Branding (desktop only) */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative z-10 p-12">
        <div className="max-w-md animate-fadeInUp">
          <div className="text-6xl mb-6">🧬</div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Laboratory<br />Information<br />System
          </h1>
          <p className="text-blue-200 text-lg mb-8">
            Complete lab management — from blood sample to patient report.
            Connect analyzers, manage results, and deliver reports digitally.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: '🔬', text: 'Machine Integration' },
              { icon: '📊', text: 'Real-time Results' },
              { icon: '📄', text: 'PDF Reports' },
              { icon: '📱', text: 'WhatsApp Delivery' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-blue-100/80 animate-fadeIn" style={{animationDelay: `${0.2 + i * 0.1}s`}}>
                <span className="text-2xl">{f.icon}</span>
                <span className="text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-start sm:items-center justify-center relative z-10 p-4 sm:p-6 pt-10 sm:pt-6">
        <div className="bg-white rounded-3xl shadow-2xl p-5 sm:p-8 w-full max-w-md animate-scaleIn">
          {/* Logo */}
          <div className="text-center mb-5">
            <div className="w-11 h-11 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2.5 shadow-lg shadow-blue-600/30">
              <span className="text-xl sm:text-2xl">🧬</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Welcome Back</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Sign in to your LIS account</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm flex items-center gap-2 animate-slideDown">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">👤</span>
                <input
                  type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50/50"
                  placeholder="Enter username" required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300" />
                <span className="text-slate-600">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                Sign Up
              </Link>
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-xs text-slate-400 uppercase">or</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          {/* Patient Portal Link */}
          <Link to="/portal"
            className="w-full py-2.5 border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm">
            <span>🏥</span> Patient Portal — View My Reports
          </Link>
        </div>
      </div>
    </div>
  )
}
