import React, { useState } from 'react'
import ChangePasswordForm from '../components/ChangePasswordForm.jsx'
import { ErrorBox } from '../components/ui.jsx'
import { roleLabel } from '../lib/roles.js'
import { logoutAll } from '../services/auth.js'

/** The signed-in user's own settings: password and sessions. */
export default function Account({ user }) {
  const [changed, setChanged] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function signOutEverywhere() {
    if (!confirm('Sign out on every device, including this one?')) return
    setBusy(true)
    setError('')
    try {
      await logoutAll() // App returns to the login screen
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>My account</h2>
        <p>{user.full_name} · {roleLabel(user.user_type)}</p>
      </div>

      <div className="grid cols-2 items-start">
        <div className="card">
          <h3>Change password</h3>
          {changed && <div className="notice mb-3.5">Password changed. Your other devices were signed out.</div>}
          <ChangePasswordForm onDone={() => setChanged(true)} />
        </div>

        <div className="card">
          <h3>Signed-in devices</h3>
          <p className="muted mb-3.5">
            Lost a phone or used a shared computer? Sign out everywhere, then sign in again here.
          </p>
          <ErrorBox error={error} />
          <button className="ghost" disabled={busy} onClick={signOutEverywhere}>
            {busy ? 'Signing out…' : 'Sign out of all devices'}
          </button>
        </div>
      </div>
    </>
  )
}
