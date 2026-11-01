import React, { useState } from 'react'
import { api, fmtDate, photoUrl } from '../api.js'
import { FileViewer, IMAGE_ACCEPT, fileProblem } from '../components/Attachment.jsx'
import { DateInput, Empty, ErrorBox, Field, Modal, Pager, TimeInput } from '../components/ui.jsx'
import usePagedList from '../hooks/usePagedList.js'
import { timeRange } from '../lib/format.js'
import { isManager } from '../lib/roles.js'

const EMPTY = { title: '', description: '', venue: '', start_date: '', end_date: '', start_time: '', end_time: '' }

/**
 * School events (annual day, sports day, tours). Upcoming until the end
 * date has passed, then completed — add photos and video links afterwards.
 * Parents see them in the app (Events). Managers edit; staff can view.
 */
export default function Events({ user }) {
  const canEdit = isManager(user.user_type)
  const [tab, setTab] = useState('upcoming')
  const list = usePagedList(`/events?status=${tab}`, 20)
  const [editing, setEditing] = useState(null)
  const [media, setMedia] = useState(null)
  const [error, setError] = useState('')

  async function remove(ev) {
    if (!confirm(`Delete "${ev.title}" and its photos?`)) return
    try {
      await api(`/events/${ev.id}`, { method: 'DELETE' })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Events</h2>
          <p>Shown to parents in the app; completed events can carry photos and videos.</p>
        </div>
        {canEdit && <button className="fit" onClick={() => setEditing({ form: EMPTY })}>+ New event</button>}
      </div>
      <div className="tabs">
        {[['upcoming', 'Upcoming'], ['completed', 'Completed']].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <ErrorBox error={error || list.error} />

      <div className="card">
        {!list.rows ? (
          <div className="skeleton">Loading…</div>
        ) : list.rows.length === 0 ? (
          <Empty icon="🎉" text={tab === 'upcoming' ? 'No upcoming events.' : 'No completed events yet.'} />
        ) : (
          list.rows.map((ev) => (
            <div className="list-item" key={ev.id}>
              <div className="split">
                <strong>{ev.title}</strong>
                {canEdit && (
                  <div className="btn-row">
                    <button className="soft sm" onClick={() => setMedia(ev)}>Photos & videos ({ev.media.length})</button>
                    <button className="ghost sm" onClick={() => setEditing({
                      id: ev.id,
                      form: {
                        title: ev.title, description: ev.description || '', venue: ev.venue || '',
                        start_date: ev.start_date.slice(0, 10), end_date: ev.end_date.slice(0, 10),
                        start_time: ev.start_time || '', end_time: ev.end_time || '',
                      },
                    })}>Edit</button>
                    <button className="danger sm" onClick={() => remove(ev)}>Delete</button>
                  </div>
                )}
              </div>
              <div className="muted small mt-0.5">
                📅 {fmtDate(ev.start_date)}{ev.end_date !== ev.start_date ? ` – ${fmtDate(ev.end_date)}` : ''}
                {ev.start_time ? ` · ${timeRange(ev.start_time, ev.end_time)}` : ''}
                {ev.venue ? ` · 📍 ${ev.venue}` : ''}
              </div>
              {ev.description && <div className="mt-1 whitespace-pre-wrap">{ev.description}</div>}
              {!canEdit && ev.media.length > 0 && <MediaStrip media={ev.media} />}
            </div>
          ))
        )}
        <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
      </div>

      {editing && <EventForm editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload() }} />}
      {media && <MediaEditor event={media} onClose={() => { setMedia(null); list.reload() }} />}
    </>
  )
}

function MediaStrip({ media, onRemove }) {
  const [open, setOpen] = useState(null)
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {media.map((m) => (
        <div key={m.id} className="relative">
          {m.kind === 'image' ? (
            <button type="button" className="p-0" onClick={() => setOpen(m)} aria-label="Open photo">
              <img src={photoUrl(m.media_path)} alt={m.caption || ''} className="h-20 w-20 rounded-lg object-cover" />
            </button>
          ) : (
            <a className="filelink" href={m.url} target="_blank" rel="noreferrer">▶ {m.caption || 'Video'}</a>
          )}
          {onRemove && (
            <button type="button" className="danger absolute -right-2 -top-2 px-2 py-0.5 text-[11px]"
              onClick={() => onRemove(m)} aria-label="Remove">✕</button>
          )}
        </div>
      ))}
      {open && <FileViewer path={open.media_path} type="image" title={open.caption || 'Photo'} onClose={() => setOpen(null)} />}
    </div>
  )
}

function EventForm({ editing, onClose, onSaved }) {
  const [form, setForm] = useState(editing.form)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body = {
      title: form.title.trim(), description: form.description.trim() || null, venue: form.venue.trim() || null,
      start_date: form.start_date, end_date: form.end_date || null,
      start_time: form.start_time || null, end_time: form.end_time || null,
    }
    try {
      if (editing.id) await api(`/events/${editing.id}`, { method: 'PUT', body })
      else await api('/events', { method: 'POST', body })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={editing.id ? 'Edit event' : 'New event'} onClose={onClose} error={error}>
      <form onSubmit={save} className="grid">
        <Field label="Title *"><input value={form.title} onChange={set('title')} required maxLength={150} autoFocus /></Field>
        <div className="grid cols-2">
          <Field label="Starts *"><DateInput value={form.start_date} onChange={set('start_date')} required /></Field>
          <Field label="Ends"><DateInput value={form.end_date} min={form.start_date || undefined} onChange={set('end_date')} /></Field>
          <Field label="From"><TimeInput value={form.start_time} onChange={set('start_time')} /></Field>
          <Field label="To"><TimeInput value={form.end_time} onChange={set('end_time')} /></Field>
        </div>
        <Field label="Venue"><input value={form.venue} onChange={set('venue')} maxLength={150} /></Field>
        <Field label="Details"><textarea rows={4} value={form.description} onChange={set('description')} maxLength={4000} /></Field>
        <button disabled={busy}>{busy ? 'Saving…' : editing.id ? 'Save changes' : 'Create event'}</button>
      </form>
    </Modal>
  )
}

function MediaEditor({ event, onClose }) {
  const [media, setMedia] = useState(event.media)
  const [video, setVideo] = useState({ url: '', caption: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function addPhotos(files) {
    const list = [...files]
    const tooBig = list.map((f) => fileProblem(f, 8)).find(Boolean)
    if (tooBig) return setError(tooBig)
    setBusy(true)
    setError('')
    try {
      for (const file of list) {
        const fd = new FormData()
        fd.append('file', file)
        const added = await api(`/events/${event.id}/photos`, { method: 'POST', formData: fd })
        setMedia((m) => [...m, added])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function addVideo(e) {
    e.preventDefault()
    setError('')
    try {
      const added = await api(`/events/${event.id}/videos`, {
        method: 'POST', body: { url: video.url.trim(), caption: video.caption.trim() || null },
      })
      setMedia((m) => [...m, { ...added, caption: video.caption.trim() || null }])
      setVideo({ url: '', caption: '' })
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(m) {
    try {
      await api(`/events/${event.id}/media/${m.id}`, { method: 'DELETE' })
      setMedia((all) => all.filter((x) => x.id !== m.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={`Photos & videos — ${event.title}`} onClose={onClose} error={error} wide>
      <div className="grid gap-4">
        {media.length ? <MediaStrip media={media} onRemove={remove} /> : <Empty icon="🖼️" text="No photos or videos yet." />}
        <Field label="Add photos (JPEG / PNG / WebP, up to 8 MB each)">
          <input type="file" accept={IMAGE_ACCEPT} multiple disabled={busy} onChange={(e) => addPhotos(e.target.files)} />
        </Field>
        <form onSubmit={addVideo} className="row">
          <Field label="Video link (YouTube, Google Drive…)">
            <input type="url" value={video.url} required placeholder="https://"
              onChange={(e) => setVideo({ ...video, url: e.target.value })} />
          </Field>
          <Field label="Caption">
            <input value={video.caption} maxLength={200} onChange={(e) => setVideo({ ...video, caption: e.target.value })} />
          </Field>
          <button className="fit">Add video</button>
        </form>
      </div>
    </Modal>
  )
}
