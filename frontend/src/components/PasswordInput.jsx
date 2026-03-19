import { useState } from 'react'

export default function PasswordInput({ value, onChange, placeholder = 'Enter password', name = 'password', required = true, minLength, className = '' }) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔒</span>
      <input
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className={`w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50/50 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-sm select-none"
        tabIndex={-1}
      >
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  )
}
