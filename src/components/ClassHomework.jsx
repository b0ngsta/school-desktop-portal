import React, { Fragment, useEffect, useState } from 'react'
import { api, fmtDate } from '../api.js'
import usePagedList from '../hooks/usePagedList.js'
import { localISODate } from '../lib/format.js'
import { Avatar, DateInput, Empty, ErrorBox, Field, Modal, Pager } from './ui.jsx'

const EMPTY = { title: '', subject: '', due_date: '', note: '' }
const STATUS = [['pending', 'Pending'], ['submitted', 'Submitted'], ['late', 'Late']]

/**
 * Homework for a whole section: one entry reaches every student (parents
 * are notified). Expand an entry to mark who handed it in.
 */
export default function ClassHomework({ classId, sectionId, subjects = [], canAssign = true }) {
  const list = usePagedList(`/homework?class_id=${classId}&section_id=${sectionId}`, 20)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function add(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/homework', {
        method: 'POST',
        body: {
          class_id: Number(classId), section_id: Number(sectionId), title: form.title.trim(),
          subject: form.subject.trim() || null, due_date: form.due_date || null, note: form.note.trim() || null,
        },
      })
      setForm(EMPTY)
      list.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(h) {
    if (!confirm(`Delete "${h.title}" for every student of this section?`)) return
    try {
      await api(`/homework/${h.id}`, { method: 'DELETE' })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const today = localISODate()
  return (
    <>
      <ErrorBox error={error || list.error} />
      {canAssign && (
        <div className="card">
          <h3>Give homework to the whole class</h3>
          <form onSubmit={add} className="row">
            <Field label="Title *">
              <input value={form.title} required placeholder="e.g. Exercise 4.2, Q1–10"
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Subject">
              <input value={form.subject} list="hw-subjects" placeholder="e.g. Mathematics"
                onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              <datalist id="hw-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="Due date">
              <DateInput value={form.due_date} min={today} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </Field>
            <Field label="Note for parents">
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <button className="fit" disabled={busy}>{busy ? 'Giving…' : 'Give homework'}</button>
          </form>
        </div>
      )}

      <div className="card">
        {!list.rows ? (
          <div className="skeleton">Loading…</div>
        ) : list.rows.length === 0 ? (
          <Empty icon="📝" text="No homework given to this class yet." />
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 680 }}>
              <thead>
                <tr><th>Homework</th><th>Due</th><th>Handed in</th><th>By</th><th /></tr>
              </thead>
              <tbody>
                {list.rows.map((h) => {
                  const c = h.counts
                  const overdue = h.due_date && h.due_date.slice(0, 10) < today
                  return (
                    <Fragment key={h.id}>
                      <tr>
                        <td>
                          <b>{h.title}</b>
                          {h.subject && <span className="badge gray ml-2">{h.subject}</span>}
                          {h.note && <div className="muted small">{h.note}</div>}
                        </td>
                        <td className={overdue ? 'text-danger' : ''}>{fmtDate(h.due_date)}</td>
                        <td>
                          {c ? (
                            <div className="flex flex-wrap gap-1">
                              <span className="badge green">{c.submitted} submitted</span>
                              <span className="badge amber">{c.pending} pending</span>
                              {c.late ? <span className="badge red">{c.late} late</span> : null}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="muted">{h.assigned_by || '—'}</td>
                        <td className="actions">
                          <button className="soft sm" onClick={() => setOpen(open === h.id ? null : h.id)}>
                            {open === h.id ? 'Close' : 'Mark submissions'}
                          </button>
                          <button className="ghost sm" onClick={() => setEditing(h)}>Edit</button>
                          <button className="danger sm" onClick={() => remove(h)}>Delete</button>
                        </td>
                      </tr>
                      {open === h.id && (
                        <tr>
                          <td colSpan={5} className="bg-page">
                            <Submissions homework={h} onSaved={list.reload} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
      </div>

      {editing && (
        <EditModal homework={editing} subjects={subjects} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); list.reload() }} />
      )}
    </>
  )
}

function Submissions({ homework, onSaved }) {
  const [rows, setRows] = useState(null)
  const [changed, setChanged] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')

  const load = () => api(`/homework/${homework.id}/submissions`)
    .then((r) => { setRows(r || []); setChanged({}) })
    .catch((e) => { setRows([]); setError(e.message) })
  useEffect(() => { load() }, [homework.id])

  const statusOf = (s) => changed[s.student_id] ?? s.status
  const set = (s, status) => {
    setDone('')
    setChanged((c) => {
      const next = { ...c }
      if (status === s.status) delete next[s.student_id]
      else next[s.student_id] = status
      return next
    })
  }
  const all = (status) => {
    setDone('')
    const next = {}
    for (const s of rows || []) if (s.status !== status) next[s.student_id] = status
    setChanged(next)
  }

  async function save() {
    const items = Object.entries(changed).map(([id, status]) => ({ student_id: Number(id), status }))
    if (!items.length) return
    setBusy(true)
    setError('')
    try {
      await api(`/homework/${homework.id}/submissions`, { method: 'PUT', body: { items } })
      setDone(`Saved ${items.length} change${items.length === 1 ? '' : 's'}.`)
      await load()
      onSaved?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!rows) return <div className="skeleton">Loading students…</div>
  const n = Object.keys(changed).length
  return (
    <div className="grid gap-2.5 py-1">
      <ErrorBox error={error} className="mb-0" />
      {done && <div className="notice ok">{done}</div>}
      <div className="btn-row">
        <button className="soft sm" onClick={() => all('submitted')}>All submitted</button>
        <button className="ghost sm" onClick={() => all('pending')}>All pending</button>
        <div className="flex-1" />
        <button className="sm" disabled={!n || busy} onClick={save}>{busy ? 'Saving…' : n ? `Save ${n} change${n === 1 ? '' : 's'}` : 'No changes'}</button>
      </div>
      {rows.length === 0 ? (
        <Empty icon="🧑‍🎓" text="No students in this section yet." />
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {rows.map((s) => (
            <div key={s.student_id}
              className={`flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2 ${changed[s.student_id] ? 'border-brand' : 'border-line'}`}>
              <Avatar name={s.full_name} photo={s.photo_path} size={30} />
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px]">{s.full_name}</b>
                <span className="muted text-[11.5px]">Roll {s.roll_no || '—'}</span>
              </div>
              <select value={statusOf(s)} onChange={(e) => set(s, e.target.value)} className="w-[120px] py-1.5"
                aria-label={`Status for ${s.full_name}`}>
                {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EditModal({ homework, subjects, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: homework.title, subject: homework.subject || '', due_date: (homework.due_date || '').slice(0, 10), note: homework.note || '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/homework/${homework.id}`, {
        method: 'PUT',
        body: { title: form.title.trim(), subject: form.subject.trim() || null, due_date: form.due_date || null, note: form.note.trim() || null },
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Edit homework" onClose={onClose} error={error}>
      <form onSubmit={submit} className="grid">
        <Field label="Title *"><input value={form.title} required onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="grid cols-2">
          <Field label="Subject">
            <input value={form.subject} list="hw-edit-subjects" onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <datalist id="hw-edit-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Due date">
            <DateInput value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
        </div>
        <Field label="Note for parents"><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <button disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </Modal>
  )
}
