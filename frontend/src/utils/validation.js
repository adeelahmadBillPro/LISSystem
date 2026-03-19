/**
 * Input validation utilities for all forms.
 */

// Phone number validation (Pakistan format)
export function isValidPhone(phone) {
  if (!phone) return true // optional field
  const cleaned = phone.replace(/[-\s()]/g, '')
  return /^(03\d{9}|92\d{10}|\+92\d{10})$/.test(cleaned)
}

export function formatPhone(phone) {
  const cleaned = phone.replace(/[^\d]/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`
  }
  return phone
}

// Name validation — only letters, spaces, dots, hyphens
export function isValidName(name) {
  if (!name) return false
  return /^[a-zA-Z\s.\-']{2,100}$/.test(name.trim())
}

// Username validation
export function isValidUsername(username) {
  if (!username) return false
  return /^[a-zA-Z0-9_]{3,50}$/.test(username)
}

// Email validation
export function isValidEmail(email) {
  if (!email) return true // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// MRN validation — alphanumeric, no special chars
export function isValidMRN(mrn) {
  if (!mrn) return false
  return /^[a-zA-Z0-9\-]{1,50}$/.test(mrn)
}

// Sample ID validation
export function isValidSampleId(id) {
  if (!id) return false
  return /^[a-zA-Z0-9\-]{1,50}$/.test(id)
}

// Number validation — positive numbers only
export function isValidNumber(val) {
  if (val === '' || val === null || val === undefined) return true
  const num = Number(val)
  return !isNaN(num) && num >= 0
}

// Price validation
export function isValidPrice(val) {
  if (!val && val !== 0) return false
  const num = Number(val)
  return !isNaN(num) && num >= 0 && num <= 9999999
}

// Password strength
export function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  const levels = [
    { label: 'Very Weak', color: 'bg-red-500' },
    { label: 'Weak', color: 'bg-orange-500' },
    { label: 'Fair', color: 'bg-yellow-500' },
    { label: 'Good', color: 'bg-blue-500' },
    { label: 'Strong', color: 'bg-green-500' },
  ]
  const level = levels[Math.min(score, 4)]
  return { score, ...level, percent: (score / 5) * 100 }
}

// Generic required field check
export function validateRequired(fields) {
  const errors = {}
  for (const [key, value] of Object.entries(fields)) {
    if (!value || (typeof value === 'string' && !value.trim())) {
      errors[key] = 'This field is required'
    }
  }
  return errors
}

// Sanitize input - strip HTML
export function sanitizeInput(value) {
  if (!value) return value
  return value.replace(/<[^>]*>/g, '').trim()
}
