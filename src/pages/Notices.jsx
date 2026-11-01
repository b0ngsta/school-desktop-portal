import React, { useEffect, useState } from 'react'
import { api, fmtDateTime } from '../api.js'
import { AttachmentChip, FileField, fileProblem } from '../components/Attachment.jsx'
import { Empty, Field, Modal } from '../components/ui.jsx'
import { isManager } from '../lib/roles.js'

export default function Notices({ user }) {
  const [notices, setNotices] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', body: '' })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const canPost = isManager(user.user_type)

  const load = () => api('/notices').then(setNotices).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function submit(e) {
    e.preventDefault()
    const problem = fileProblem(file)
    if (problem) return setError(problem)
    setSaving(true)
    setError('')
    try {
      const { id } = await api('/notices', { method: 'POST', body: form })
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        try {
          await api(`/notices/${id}/attachment`, { method: 'POST', formData: fd })
        } catch (err) {
          setError(`The notice was published, but the file could not be attached: ${err.message}`)
        }
      }
      setForm({ title: '', body: '' })
      setFile(null)
      setCreating(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
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
          <p>{canPost ? 'Announcements for all staff and parents (shown in the parent app).' : 'Announcements from the school.'}</p>
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
              {n.attachment_path && (
                <div className="mt-2">
                  <AttachmentChip path={n.attachment_path} name={n.attachment_name} type={n.attachment_type} />
                </div>
              )}
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
            <FileField file={file} onChange={setFile} />
            <button disabled={saving}>{saving ? 'Publishing…' : 'Publish'}</button>
          </form>
        </Modal>
      )}
    </>
  )
}
