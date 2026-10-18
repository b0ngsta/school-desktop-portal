import React, { useState } from 'react'
import { passwordError } from '../lib/validators.js'
import { changePassword } from '../services/auth.js'
import { ErrorBox, Field, PasswordInput } from './ui.jsx'

/** Current + new password. Other devices are signed out; this one stays signed in. */
export default function ChangePasswordForm({ onDone, submitLabel = 'Change password' }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    const invalid = passwordError(form.next, form.confirm)
    if (invalid) return setError(invalid)
    if (form.next === form.current) return setError('New password must be different from the current one')
    setBusy(true)
    setError('')
    try {
      const user = await changePassword(form.current, form.next)
      setForm({ current: '', next: '', confirm: '' })
      onDone?.(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="grid" onSubmit={submit}>
      <Field label="Current password">
        <PasswordInput value={form.current} onChange={set('current')} required />
      </Field>
      <Field label="New password">
        <PasswordInput newPassword value={form.next} onChange={set('next')} required />
      </Field>
      <Field label="Repeat new password">
        <PasswordInput newPassword value={form.confirm} onChange={set('confirm')} required />
      </Field>
      <p className="muted small">At least 6 characters. Your other devices will be signed out.</p>
      <ErrorBox error={error} className="mb-0" />
      <button disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
    </form>
  )
}
