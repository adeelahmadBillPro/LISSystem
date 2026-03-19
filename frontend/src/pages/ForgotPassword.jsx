import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import PasswordInput from '../components/PasswordInput'

export default function ForgotPassword() {
  const [step, setStep] = useState(1) // 1=enter username, 2=enter code+new pass, 3=success
  const [username, setUsername] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleRequestReset = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await api.post('/auth/forgot-password', { username })
      setMessage(res.data.message)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reset code')
    } finally { setLoading(false) }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        username,
        reset_code: resetCode,
        new_password: newPassword,
      })
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse-soft"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-soft" style={{animationDelay: '1s'}}></div>
      </div>

      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-md relative z-10 animate-scaleIn">

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="text-center animate-fadeIn">
            <div className="text-6xl mb-4 animate-bounce">🔓</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Password Reset!</h2>
            <p className="text-slate-500 mb-6">Your password has been changed successfully.</p>
            <Link to="/login"
              className="inline-block px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all">
              Sign In Now
            </Link>
          </div>
        )}

        {/* Step 1: Enter username */}
        {step === 1 && (
          <div className="animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
                <span className="text-2xl">🔑</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Forgot Password?</h2>
              <p className="text-slate-500 text-sm mt-1">Enter your username to get a reset code</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm animate-slideDown">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">👤</span>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
                    placeholder="Enter your username"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50/50" />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg active:scale-[0.98]">
                {loading ? 'Sending...' : 'Get Reset Code'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                ← Back to Sign In
              </Link>
            </div>
          </div>
        )}

        {/* Step 2: Enter code + new password */}
        {step === 2 && (
          <div className="animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <span className="text-2xl">🔐</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Reset Password</h2>
              <p className="text-slate-500 text-sm mt-1">{message}</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm animate-slideDown">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Reset Code</label>
                <input type="text" value={resetCode} onChange={(e) => setResetCode(e.target.value)} required
                  placeholder="Enter the reset code"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50/50 text-center text-lg tracking-widest font-mono" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                <PasswordInput name="confirm_password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg active:scale-[0.98]">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>

            <button onClick={() => setStep(1)} className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors">
              ← Try different username
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
