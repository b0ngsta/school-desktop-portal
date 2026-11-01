import React, { useEffect, useState } from 'react'
import { api, photoUrl } from '../api.js'
import { IMAGE_ACCEPT } from '../components/Attachment.jsx'
import { ErrorBox, Field } from '../components/ui.jsx'
import { isMissingEndpoint } from '../hooks/useApi.js'

const FIELDS = [
  ['director_name', 'Director', 100],
  ['principal_name', 'Principal (leave blank to use the principal account)', 100],
  ['affiliation_no', 'Affiliation number', 50],
  ['phone', 'Phone (mobile)', 20],
  ['tel', 'Telephone', 20],
  ['email', 'Email', 120],
  ['website', 'Website', 200],
]
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December']

const toForm = (p) => ({
  ...Object.fromEntries(FIELDS.map(([k]) => [k, p[k] || ''])),
  address: p.address || '',
  session_start_month: String(p.session_start_month || 4),
})

/**
 * The school's profile shown to parents in the app (School Info screen):
 * logo, director, principal, affiliation, contacts, address and the month
 * the academic session starts. Admin / principal edit; other managers read.
 * The school's name and login code are managed by EduManage HQ.
 */
export default function SchoolProfile({ user }) {
  const canEdit = ['admin', 'principal'].includes(user.user_type)
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api('/school')
    .then((p) => { setProfile(p); setForm(toForm(p)) })
    .catch((e) => (isMissingEndpoint(e) ? setMissing(true) : setError(e.message)))
  useEffect(() => { load() }, [])

  if (missing) return <div className="notice">The School profile needs the latest server update.</div>
  if (!form) return error ? <ErrorBox error={error} /> : <div className="skeleton">Loading…</div>

  const set = (k) => (e) => { setDone(''); setForm({ ...form, [k]: e.target.value }) }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const p = await api('/school', {
        method: 'PUT',
        body: { ...form, session_start_month: Number(form.session_start_month) },
      })
      setProfile(p)
      setForm(toForm(p))
      setDone('Saved. Parents see the new details the next time they open School Info.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function uploadLogo(file) {
    if (!file) return
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api('/school/logo', { method: 'POST', formData: fd })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeLogo() {
    if (!confirm('Remove the school logo?')) return
    try {
      await api('/school/logo', { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>School profile</h2>
        <p>Shown to parents in the app (School Info). The school name and code are set by EduManage.</p>
      </div>
      <ErrorBox error={error} />
      {done && <div className="notice ok">{done}</div>}

      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border border-line bg-page">
            {profile.logo_path ? <img src={photoUrl(profile.logo_path)} alt="School logo" className="h-full w-full object-contain" />
              : <span className="text-[34px]">🏫</span>}
          </div>
          <div className="flex-1">
            <h3 className="text-[18px] font-extrabold">{profile.name}</h3>
            <div className="muted small">Code {profile.code} · Session {profile.session?.label}</div>
            {canEdit && (
              <div className="btn-row mt-2">
                <label className="filelink mb-0 cursor-pointer">
                  {profile.logo_path ? 'Change logo' : 'Upload logo'}
                  <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => uploadLogo(e.target.files[0])} />
                </label>
                {profile.logo_path && <button type="button" className="ghost sm" onClick={removeLogo}>Remove</button>}
              </div>
            )}
          </div>
        </div>
      </div>

      <form className="card grid" onSubmit={save}>
        <div className="grid cols-2">
          {FIELDS.map(([k, label, max]) => (
            <Field key={k} label={label}>
              <input value={form[k]} onChange={set(k)} maxLength={max} disabled={!canEdit}
                type={k === 'email' ? 'email' : 'text'} />
            </Field>
          ))}
          <Field label="Academic session starts in">
            <select value={form.session_start_month} onChange={set('session_start_month')} disabled={!canEdit}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Address">
          <textarea rows={2} value={form.address} onChange={set('address')} maxLength={300} disabled={!canEdit} />
        </Field>
        {canEdit && <button className="fit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>}
      </form>
    </>
  )
}
