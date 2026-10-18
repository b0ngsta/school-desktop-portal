/** Client-side checks that mirror the backend (app/core/validators.py). */

export const EMAIL_MAX_LENGTH = 120
export const PASSWORD_MIN_LENGTH = 6
export const PASSWORD_MAX_LENGTH = 128

const LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?'
const EMAIL_RE = new RegExp(`^[A-Za-z0-9.!#$%&'*+/=?^_\`{|}~-]+@${LABEL}(?:\\.${LABEL})+$`)

/** Returns an error message, or '' when the value is fine. */
export function emailError(value, { required = true } = {}) {
  const v = (value || '').trim()
  if (!v) return required ? 'Email is required' : ''
  if (v.length > EMAIL_MAX_LENGTH) return `Email must be at most ${EMAIL_MAX_LENGTH} characters`
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address (e.g. name@school.in)'
  return ''
}

export function passwordError(value, confirm) {
  if (!value || value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`
  }
  if (confirm !== undefined && value !== confirm) return 'Passwords do not match'
  return ''
}

/** Trim strings and turn blanks into null (what the JSON APIs expect). */
export function blanksToNull(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const t = typeof v === 'string' ? v.trim() : v
    out[k] = t === '' ? null : t
  }
  return out
}
