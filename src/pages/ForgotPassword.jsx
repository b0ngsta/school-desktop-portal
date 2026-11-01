import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import SchoolCodeField from '../components/SchoolCodeField.jsx'
import { ErrorBox, Field, PasswordInput } from '../components/ui.jsx'
import useSchoolName from '../hooks/useSchoolName.js'
import { fmtWait } from '../lib/format.js'
import { passwordError } from '../lib/validators.js'
import { requestResetCode, resetPassword, verifyResetCode } from '../services/auth.js'
import { getLastOrgCode } from '../services/session.js'

const RESEND_COOLDOWN = 30 // seconds between "send a new code" clicks
const CODE_RE = /^\d{6}$/

/**
 * Three steps: which school + who are you → enter the emailed code → choose
 * a new password. A successful reset signs this device in (App picks up the
 * new session).
 */
export default function ForgotPassword() {
  const [step, setStep] = useState('request') // request | code | password
  const [orgCode, setOrgCode] = useState(getLastOrgCode)
  const school = useSchoolName(orgCode)
  const [login, setLogin] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const cooldown = useCountdown()

  async function sendCode() {
    setBusy(true)
    setError('')
    try {
      const res = await requestResetCode(login, orgCode)
      setCode('')
      setStep('code')
      setNotice(`If an account matches, we've emailed a 6-digit code. It expires in ${fmtWait(res.code_expires_in || 900)}.`)
      cooldown.start(RESEND_COOLDOWN)
    } catch (err) {
      setError(err.message)
      if (err.retryAfter) cooldown.start(err.retryAfter)
    } finally {
      setBusy(false)
    }
  }

  async function checkCode(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await verifyResetCode(login, code, orgCode)
      setNotice('')
      setStep('password')
    } catch (err) {
      setError(err.status === 400 ? 'Wrong or expired code. Check the email or send a new code.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const title = { request: 'Forgot password?', code: 'Enter the code', password: 'New password' }[step]

  return (
    <AuthLayout
      title={title}
      footer={<Link className="text-link" to="/">← Back to sign in</Link>}
    >
      {step === 'request' && (
        <form className="grid" onSubmit={(e) => { e.preventDefault(); sendCode() }}>
          <SchoolCodeField value={orgCode} onChange={setOrgCode} school={school} autoFocus={!orgCode} />
          <Field label="Username or email">
            <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username"
              autoCapitalize="none" maxLength={120} required autoFocus={Boolean(orgCode)} />
          </Field>
          <ul className="hint-list">
            <li>Several children on one email? Enter the child's username.</li>
            <li>No email on your account? Ask the school office.</li>
          </ul>
          <ErrorBox error={error} className="mb-0" />
          <button disabled={busy || cooldown.left > 0 || school.state === 'unknown'}>
            {busy ? 'Sending…' : cooldown.left > 0 ? `Wait ${cooldown.left}s` : 'Send code'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form className="grid" onSubmit={checkCode}>
          {notice && <div className="notice">{notice}</div>}
          <Field label="6-digit code">
            <input className="code-input" value={code} autoFocus required
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
              placeholder="••••••" />
          </Field>
          <ErrorBox error={error} className="mb-0" />
          <button disabled={busy || !CODE_RE.test(code)}>{busy ? 'Checking…' : 'Continue'}</button>
          <div className="split">
            <button type="button" className="link" onClick={() => { setError(''); setStep('request') }}>
              Change school/username
            </button>
            <button type="button" className="link" disabled={busy || cooldown.left > 0} onClick={sendCode}>
              {cooldown.left > 0 ? `Send a new code (${cooldown.left}s)` : 'Send a new code'}
            </button>
          </div>
          <p className="muted small">Only the newest code works. 5 wrong tries use a code up.</p>
        </form>
      )}

      {step === 'password' && (
        <NewPasswordForm
          onSubmit={(pw) => resetPassword(login, code, pw, orgCode)}
          onCodeRejected={(msg) => { setError(msg); setStep('code') }}
        />
      )}
    </AuthLayout>
  )
}

function NewPasswordForm({ onSubmit, onCodeRejected }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const invalid = passwordError(password, confirm)
    if (invalid) return setError(invalid)
    setBusy(true)
    setError('')
    try {
      await onSubmit(password) // signs in: App switches to the home screen
    } catch (err) {
      setBusy(false)
      if (err.status === 400) onCodeRejected('Wrong or expired code. Send a new code and try again.')
      else setError(err.message)
    }
  }

  return (
    <form className="grid" onSubmit={submit}>
      <Field label="New password">
        <PasswordInput newPassword value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
      </Field>
      <Field label="Repeat new password">
        <PasswordInput newPassword value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <p className="muted small">At least 6 characters. You'll be signed out on every other device.</p>
      <ErrorBox error={error} className="mb-0" />
      <button disabled={busy}>{busy ? 'Saving…' : 'Set password and sign in'}</button>
    </form>
  )
}

/** Seconds-left countdown for rate-limited buttons. */
function useCountdown() {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (until <= now) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [until, now])
  return {
    left: Math.max(0, Math.ceil((until - now) / 1000)),
    start: (seconds) => { const t = Date.now(); setNow(t); setUntil(t + seconds * 1000) },
  }
}
