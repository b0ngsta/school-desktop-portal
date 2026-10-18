import React, { useEffect, useState } from 'react'
import { api, fmtDateTime } from '../api.js'
import { Empty, Field, Modal } from '../components/ui.jsx'

export default function Notices({ user }) {
  const [notices, setNotices] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', body: '' })
  const canPost = ['admin', 'principal'].includes(user.user_type)

  const load = () => api('/notices').then(setNotices).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function submit(e) {
    e.preventDefault()
    try {
      await api('/notices', { method: 'POST', body: form })
      setForm({ title: '', body: '' })
      setCreating(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this notice?')) return
    try {
      await api(`/notices/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Notices</h2>
          <p>{canPost ? 'Broadcast announcements to all staff.' : 'Announcements from the school.'}</p>
        </div>
        {canPost && (
          <button className="fit" onClick={() => setCreating(true)}>+ New notice</button>
        )}
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        {!notices ? (
          <div className="skeleton">Loading…</div>
        ) : notices.length === 0 ? (
          <Empty icon="📭" text="No notices yet." />
        ) : (
          notices.map((n) => (
            <div className="list-item" key={n.id}>
              <div className="row center">
                <strong style={{ flex: 1 }}>{n.title}</strong>
                {canPost && (
                  <button className="danger fit" onClick={() => remove(n.id)}>Delete</button>
                )}
              </div>
              <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.body}</div>
              <div className="muted small" style={{ marginTop: 6 }}>
                📣 {n.posted_by} · {fmtDateTime(n.created_at)}
              </div>
            </div>
          ))
        )}
      </div>

      {creating && (
        <Modal error={error} title="New notice" onClose={() => setCreating(false)}>
          <form onSubmit={submit} className="grid">
            <Field label="Title">
              <input value={form.title} required autoFocus
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Message">
              <textarea rows={4} value={form.body} required
                onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </Field>
            <button>Publish</button>
          </form>
        </Modal>
      )}
    </>
  )
}
