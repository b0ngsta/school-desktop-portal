import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import SchoolCodeField from '../components/SchoolCodeField.jsx'
import { ErrorBox, Field, PasswordInput } from '../components/ui.jsx'
import useSchoolName from '../hooks/useSchoolName.js'
import { getCaptcha, login, needsCaptcha } from '../services/auth.js'
import { getLastOrgCode } from '../services/session.js'

export default function Login({ onLogin }) {
  const [orgCode, setOrgCode] = useState(getLastOrgCode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // after a few failed tries the server asks for the characters in a picture
  const [captcha, setCaptcha] = useState(null) // {captcha_id, image, length}
  const [answer, setAnswer] = useState('')
  const school = useSchoolName(orgCode)

  async function newPicture() {
    setAnswer('')
    try {
      setCaptcha(await getCaptcha())
    } catch (err) {
      setCaptcha(null)
      setError(err.message)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const solved = captcha ? { id: captcha.captcha_id, answer } : null
      const user = await login(username, password, orgCode, solved)
      onLogin?.(user)
    } catch (err) {
      if (needsCaptcha(err)) {
        // a picture is used up by every try: always show a fresh one
        await newPicture()
        setError(captcha ? err.message : 'Type the characters in the picture to continue.')
      } else {
        // a wrong password used up the picture too
        if (captcha) await newPicture()
        setError(err.status === 401 ? 'Wrong username or password for this school.' : err.message)
      }
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="EduManage" subtitle="School management — sign in to continue.">
      <form className="grid" onSubmit={submit}>
        <SchoolCodeField value={orgCode} onChange={setOrgCode} school={school} autoFocus={!orgCode} />
        <Field label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. admin" autoComplete="username" autoCapitalize="none" required
            autoFocus={Boolean(orgCode)} />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" required />
        </Field>
        {captcha && (
          <Field label="Type the characters you see">
            <div className="row center" style={{ gap: 10, flexWrap: 'nowrap' }}>
              <img src={captcha.image} alt="Characters to type" width={180} height={64}
                style={{ borderRadius: 8, border: '1px solid var(--line)' }} />
              <button type="button" className="ghost sm fit" onClick={newPicture}
                aria-label="Show a different picture">↻ New picture</button>
            </div>
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} required
              maxLength={captcha.length + 4} autoComplete="off" autoCapitalize="characters" spellCheck={false}
              placeholder={`${captcha.length} characters`} style={{ marginTop: 8 }} />
          </Field>
        )}
        <div className="text-right">
          <Link className="text-link" to="/forgot-password">Forgot password?</Link>
        </div>
        <ErrorBox error={error} className="mb-0" />
        <button disabled={busy || school.state === 'unknown'}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthLayout>
  )
}
