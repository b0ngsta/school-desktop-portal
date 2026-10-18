import React, { useEffect, useState } from 'react'
import { api, fmtDateTime } from '../api.js'
import { Empty, Field } from '../components/ui.jsx'

const TEMPLATES = {
  '': '',
  'Fee Reminder':
    'Dear Parent, this is a reminder to clear the pending school fees at the earliest. Thank you.',
  'Holiday Notice':
    'Dear Parent, the school will remain closed tomorrow on account of a holiday.',
  'PTM Reminder':
    'Dear Parent, the Parent-Teacher Meeting is scheduled this Saturday. Your presence is requested.',
}

export default function BulkSMS() {
  const [history, setHistory] = useState(null)
  const [sections, setSections] = useState([])
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ recipient_group: 'all_parents', template: '', message: '' })

  const load = () => api('/sms').then(setHistory).catch((e) => setError(e.message))
  useEffect(() => {
    load()
    api('/classes')
      .then((classes) =>
        setSections(
          classes.flatMap((c) =>
            c.sections.map((s) => ({ id: s.id, label: `${c.name} — ${s.name} parents` }))
          )
        )
      )
      .catch(() => {})
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setOk('')
    try {
      const res = await api('/sms', {
        method: 'POST',
        body: {
          recipient_group: form.recipient_group,
          template: form.template || null,
          message: form.message,
        },
      })
      setOk(`Sent to ${res.recipients} recipients ✓`)
      setForm({ recipient_group: 'all_parents', template: '', message: '' })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>Bulk SMS</h2>
        <p>Send a message to parents or staff. (Gateway is simulated for now — history is recorded.)</p>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h3>New SMS</h3>
        <form onSubmit={submit} className="grid">
          <div className="grid cols-2">
            <Field label="Recipients">
              <select value={form.recipient_group}
                onChange={(e) => setForm({ ...form, recipient_group: e.target.value })}>
                <option value="all_parents">All parents</option>
                <option value="all_teachers">All teachers</option>
                <option value="all_staff">All staff</option>
                {sections.map((s) => (
                  <option key={s.id} value={`section:${s.id}`}>{s.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Template (optional)">
              <select value={form.template}
                onChange={(e) =>
                  setForm({
                    ...form,
                    template: e.target.value,
                    message: TEMPLATES[e.target.value] || form.message,
                  })
                }>
                <option value="">— none —</option>
                {Object.keys(TEMPLATES).filter(Boolean).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={`Message (${form.message.length}/1000)`}>
            <textarea rows={4} value={form.message} required maxLength={1000}
              placeholder="Dear Parent, …"
              onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </Field>
          <div className="row center">
            <button className="fit" disabled={busy}>{busy ? 'Sending…' : 'Send SMS'}</button>
            {ok && <span className="badge green fit">{ok}</span>}
          </div>
        </form>
      </div>

      <div className="card">
        <h3>SMS history</h3>
        {!history ? (
          <div className="skeleton">Loading…</div>
        ) : history.length === 0 ? (
          <Empty icon="💬" text="No messages sent yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recipients</th><th>Template</th><th>Message</th>
                  <th>Count</th><th>Status</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.recipient_group}</td>
                    <td>{m.template || '—'}</td>
                    <td className="muted" style={{ maxWidth: 260 }}>
                      {m.message.length > 80 ? m.message.slice(0, 80) + '…' : m.message}
                    </td>
                    <td>{m.recipients_count}</td>
                    <td>
                      <span className={`badge ${m.status === 'sent' ? 'green' : 'red'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="muted small">{fmtDateTime(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
