import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import { ErrorBox, Field, PasswordInput } from '../components/ui.jsx'
import { login } from '../services/auth.js'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await login(username, password)
      onLogin?.(user)
    } catch (err) {
      setError(err.status === 401 ? 'Wrong username or password.' : err.message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="EduManage" subtitle="School management — sign in to continue.">
      <form className="grid" onSubmit={submit}>
        <Field label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. admin" autoComplete="username" autoCapitalize="none" required />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" required />
        </Field>
        <div className="text-right">
          <Link className="text-link" to="/forgot-password">Forgot password?</Link>
        </div>
        <ErrorBox error={error} className="mb-0" />
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthLayout>
  )
}
