import React, { useEffect, useState } from 'react'
import { api, fmtDateTime } from '../api.js'
import { Empty, Field, Modal, StatCard } from '../components/ui.jsx'

const STATUS_TONE = { new: 'blue', follow_up: 'amber', converted: 'green', closed: 'gray' }
const EMPTY = { parent_name: '', student_name: '', class_interested: '', contact: '', email: '', notes: '' }

export default function Reception() {
  const [stats, setStats] = useState(null)
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY)

  async function load() {
    try {
      setStats(await api('/enquiries/stats'))
      setItems(await api('/enquiries' + (filter ? `?status_filter=${filter}` : '')))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { load() }, [filter])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    try {
      const body = { ...form }
      for (const k of Object.keys(body)) if (body[k] === '') body[k] = null
      await api('/enquiries', { method: 'POST', body })
      setForm(EMPTY)
      setCreating(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function setStatus(id, status) {
    try {
      await api(`/enquiries/${id}`, { method: 'PUT', body: { status } })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this enquiry?')) return
    try {
      await api(`/enquiries/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Reception — Enquiries</h2>
          <p>Track admission enquiries from walk-ins and calls.</p>
        </div>
        <button className="fit" onClick={() => setCreating(true)}>+ Add enquiry</button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <StatCard icon="🛎️" label="Today's enquiries" value={stats?.today} />
        <StatCard icon="✅" label="Converted" value={stats?.converted} tone="green" />
        <StatCard icon="⏳" label="Pending (new)" value={stats?.pending} tone="amber" />
        <StatCard icon="📞" label="Follow-ups" value={stats?.follow_ups} tone="blue" />
      </div>

      <div className="card">
        <div className="row center" style={{ marginBottom: 12 }}>
          <h3 style={{ flex: 1, marginBottom: 0 }}>All enquiries</h3>
          <select className="fit" style={{ width: 150 }} value={filter}
            onChange={(e) => setFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="follow_up">Follow-up</option>
            <option value="converted">Converted</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        {!items ? (
          <div className="skeleton">Loading…</div>
        ) : items.length === 0 ? (
          <Empty icon="🛎️" text="No enquiries yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th><th>Parent</th><th>Class</th><th>Contact</th>
                  <th>Status</th><th>Date</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600 }}>{q.student_name}</td>
                    <td>{q.parent_name}</td>
                    <td>{q.class_interested || '—'}</td>
                    <td>{q.contact}</td>
                    <td>
                      <select value={q.status} style={{ width: 130 }}
                        onChange={(e) => setStatus(q.id, e.target.value)}>
                        <option value="new">New</option>
                        <option value="follow_up">Follow-up</option>
                        <option value="converted">Converted</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td className="muted small">{fmtDateTime(q.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="danger" onClick={() => remove(q.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <Modal error={error} title="New enquiry" onClose={() => setCreating(false)}>
          <form onSubmit={submit} className="grid">
            <div className="grid cols-2">
              <Field label="Student name">
                <input value={form.student_name} onChange={set('student_name')} required />
              </Field>
              <Field label="Parent name">
                <input value={form.parent_name} onChange={set('parent_name')} required />
              </Field>
              <Field label="Class interested">
                <input value={form.class_interested} onChange={set('class_interested')} placeholder="e.g. Class 3" />
              </Field>
              <Field label="Contact">
                <input value={form.contact} onChange={set('contact')} required />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={set('email')} />
              </Field>
              <Field label="Notes">
                <input value={form.notes} onChange={set('notes')} />
              </Field>
            </div>
            <button>Add enquiry</button>
          </form>
        </Modal>
      )}
    </>
  )
}
