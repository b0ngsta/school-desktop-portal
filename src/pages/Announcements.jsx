import React, { useState } from 'react'
import { api, fmtDate, photoUrl } from '../api.js'
import { IMAGE_ACCEPT, fileProblem } from '../components/Attachment.jsx'
import { DateInput, Empty, ErrorBox, Field, Modal, Pager, Toggle } from '../components/ui.jsx'
import usePagedList from '../hooks/usePagedList.js'
import { localISODate } from '../lib/format.js'

const MAX_IMAGES = 5
const EMPTY = { title: '', body: '', starts_on: '', ends_on: '', is_active: true }

/** Shown now, later, or no more (same rule as the server's popup query). */
function liveState(a, today) {
  if (!a.is_active) return ['Off', 'gray']
  if (a.starts_on && a.starts_on.slice(0, 10) > today) return ['Scheduled', 'blue']
  if (a.ends_on && a.ends_on.slice(0, 10) < today) return ['Ended', 'gray']
  return ['Showing', 'green']
}

/**
 * App announcements: a popup parents see every time they open the app —
 * changed school timings, an educational tour, emergency information.
 * Title + message + up to 5 photos, optional show-from / show-until dates.
 */
export default function Announcements() {
  const list = usePagedList('/announcements', 20)
  const [editing, setEditing] = useState(null) // {form, id?, images}
  const [error, setError] = useState('')
  const today = localISODate()

  async function remove(a) {
    if (!confirm(`Delete "${a.title}"?`)) return
    try {
      await api(`/announcements/${a.id}`, { method: 'DELETE' })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggle(a) {
    try {
      await api(`/announcements/${a.id}`, {
        method: 'PUT',
        body: { title: a.title, body: a.body, starts_on: a.starts_on, ends_on: a.ends_on, is_active: !a.is_active },
      })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const open = (a) => setEditing(a ? {
    id: a.id,
    images: a.images,
    form: { title: a.title, body: a.body || '', starts_on: (a.starts_on || '').slice(0, 10), ends_on: (a.ends_on || '').slice(0, 10), is_active: !!a.is_active },
  } : { form: EMPTY, images: [] })

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>App announcements</h2>
          <p>A popup parents see every time they open the app (timings, tours, emergencies).</p>
        </div>
        <button className="fit" onClick={() => open(null)}>+ New announcement</button>
      </div>
      <ErrorBox error={error || list.error} />

      <div className="card">
        {!list.rows ? (
          <div className="skeleton">Loading…</div>
        ) : list.rows.length === 0 ? (
          <Empty icon="📢" text="No announcements yet." />
        ) : (
          list.rows.map((a) => {
            const [label, tone] = liveState(a, today)
            return (
              <div className="list-item" key={a.id}>
                <div className="split">
                  <div className="flex items-center gap-2">
                    <strong>{a.title}</strong>
                    <span className={`badge ${tone}`}>{label}</span>
                  </div>
                  <div className="btn-row">
                    <Toggle checked={!!a.is_active} onChange={() => toggle(a)} label="Show in the app" />
                    <button className="ghost sm" onClick={() => open(a)}>Edit</button>
                    <button className="danger sm" onClick={() => remove(a)}>Delete</button>
                  </div>
                </div>
                {a.body && <div className="mt-1 whitespace-pre-wrap">{a.body}</div>}
                {a.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.images.map((img) => (
                      <img key={img.id} src={photoUrl(img.image_path)} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
                <div className="muted small mt-1.5">
                  {a.starts_on ? `From ${fmtDate(a.starts_on)}` : 'From now'} · {a.ends_on ? `until ${fmtDate(a.ends_on)}` : 'until switched off'}
                  {a.created_by_name ? ` · ${a.created_by_name}` : ''}
                </div>
              </div>
            )
          })
        )}
        <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
      </div>

      {editing && (
        <Editor editing={editing} onClose={() => { setEditing(null); list.reload() }} />
      )}
    </>
  )
}

function Editor({ editing, onClose }) {
  const [form, setForm] = useState(editing.form)
  const [id, setId] = useState(editing.id || null)
  const [images, setImages] = useState(editing.images || [])
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const room = MAX_IMAGES - images.length

  async function save(e) {
    e.preventDefault()
    const tooBig = files.map((f) => fileProblem(f, 8)).find(Boolean)
    if (tooBig) return setError(tooBig)
    if (files.length > room) return setError(`At most ${MAX_IMAGES} photos per announcement.`)
    setBusy(true)
    setError('')
    try {
      const body = { ...form, body: form.body.trim() || null, starts_on: form.starts_on || null, ends_on: form.ends_on || null }
      const saved = id
        ? await api(`/announcements/${id}`, { method: 'PUT', body })
        : await api('/announcements', { method: 'POST', body })
      setId(saved.id)
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        await api(`/announcements/${saved.id}/images`, { method: 'POST', formData: fd })
      }
      onClose()
    } catch (err) {
      setError(err.message)
      setFiles([])
    } finally {
      setBusy(false)
    }
  }

  async function removeImage(img) {
    try {
      await api(`/announcements/${id}/images/${img.id}`, { method: 'DELETE' })
      setImages(images.filter((x) => x.id !== img.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={id ? 'Edit announcement' : 'New announcement'} onClose={onClose} error={error}>
      <form onSubmit={save} className="grid">
        <Field label="Title *">
          <input value={form.title} onChange={set('title')} required maxLength={150} autoFocus
            placeholder="e.g. School timing changed from Monday" />
        </Field>
        <Field label="Message">
          <textarea rows={4} value={form.body} onChange={set('body')} maxLength={4000} />
        </Field>
        <div className="grid cols-2">
          <Field label="Show from (optional)"><DateInput value={form.starts_on} onChange={set('starts_on')} /></Field>
          <Field label="Show until (optional)"><DateInput value={form.ends_on} min={form.starts_on || undefined} onChange={set('ends_on')} /></Field>
        </div>
        <div className="flex items-center gap-2.5">
          <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Show in the app" />
          <span>Show in the app</span>
        </div>
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <div key={img.id} className="relative">
                <img src={photoUrl(img.image_path)} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <button type="button" className="danger absolute -right-2 -top-2 px-2 py-0.5 text-[11px]"
                  onClick={() => removeImage(img)} aria-label="Remove photo">✕</button>
              </div>
            ))}
          </div>
        )}
        {room > 0 && (
          <Field label={`Photos (up to ${room} more, JPEG / PNG / WebP)`}>
            <input type="file" accept={IMAGE_ACCEPT} multiple onChange={(e) => setFiles([...e.target.files].slice(0, room))} />
          </Field>
        )}
        <button disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Publish'}</button>
      </form>
    </Modal>
  )
}
