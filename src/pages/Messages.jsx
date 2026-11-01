import React, { useEffect, useMemo, useState } from 'react'
import { api, fmtDateTime } from '../api.js'
import { AttachmentChip, FileField, fileProblem } from '../components/Attachment.jsx'
import { Empty, ErrorBox, Field, Modal, Pager } from '../components/ui.jsx'
import useMySections from '../hooks/useMySections.js'
import usePagedList from '../hooks/usePagedList.js'
import { isManager } from '../lib/roles.js'

const EMPTY = { title: '', body: '', target: 'section', classId: '', sectionKey: '', studentIds: [] }

/**
 * Messages to parents (they read them in the app). Managers can write to
 * any student, section, class or the whole school; class teachers to their
 * own section(s) or some of its students.
 */
export default function Messages({ user }) {
  const manager = isManager(user.user_type)
  const { classes, error: sectionsError } = useMySections(user)
  const list = usePagedList('/messages', 20)
  const [composing, setComposing] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [error, setError] = useState('')

  // teachers may only write to sections they are class teacher of
  const sections = useMemo(() => (classes || []).flatMap((c) => c.sections
    .filter((s) => manager || s.classTeacher)
    .map((s) => ({ key: `${c.id}:${s.id}`, id: s.id, label: `${c.name} — ${s.name}` }))), [classes, manager])
  const canSend = manager || sections.length > 0

  async function remove(m) {
    if (!confirm(`Delete "${m.title}"? Parents will no longer see it.`)) return
    try {
      await api(`/messages/${m.id}`, { method: 'DELETE' })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Messages to parents</h2>
          <p>{manager ? 'Write to a student, a section, a class or the whole school.' : 'Write to the parents of your class.'}</p>
        </div>
        {canSend && <button className="fit" onClick={() => setComposing(true)}>+ New message</button>}
      </div>
      <ErrorBox error={error || list.error || sectionsError} />
      {!manager && classes && !canSend && (
        <div className="notice">Only class teachers can message parents. Ask the office to send it for you.</div>
      )}

      <div className="card">
        {!list.rows ? (
          <div className="skeleton">Loading…</div>
        ) : list.rows.length === 0 ? (
          <Empty icon="✉️" text="No messages sent yet." />
        ) : (
          list.rows.map((m) => (
            <div className="list-item" key={m.id}>
              <div className="split">
                <strong>{m.title}</strong>
                <div className="btn-row">
                  <button className="soft sm" onClick={() => setViewing(m)}>
                    Read by {m.read_count}/{m.recipients_count}
                  </button>
                  <button className="danger sm" onClick={() => remove(m)}>Delete</button>
                </div>
              </div>
              <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
              {m.attachment_path && (
                <div className="mt-2">
                  <AttachmentChip path={m.attachment_path} name={m.attachment_name} type={m.attachment_type} />
                </div>
              )}
              <div className="muted small mt-1.5">To {m.audience_label} · {m.sender_name || '—'} · {fmtDateTime(m.created_at)}</div>
            </div>
          ))
        )}
        <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
      </div>

      {composing && (
        <Compose manager={manager} classes={classes || []} sections={sections}
          onClose={() => setComposing(false)} onSent={() => { setComposing(false); list.reload() }} />
      )}
      {viewing && <Recipients message={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

function Compose({ manager, classes, sections, onClose, onSent }) {
  const [form, setForm] = useState({ ...EMPTY, sectionKey: sections[0]?.key || '' })
  const [file, setFile] = useState(null)
  const [students, setStudents] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    if (form.target !== 'students' || !form.sectionKey) return setStudents([])
    const [classId, sectionId] = form.sectionKey.split(':')
    api(`/students?class_id=${classId}&section_id=${sectionId}`).then(setStudents).catch((e) => setError(e.message))
  }, [form.target, form.sectionKey])

  const toggleStudent = (id) => set({
    studentIds: form.studentIds.includes(id) ? form.studentIds.filter((x) => x !== id) : [...form.studentIds, id],
  })

  function targetBody() {
    if (form.target === 'school') return { whole_school: true }
    if (form.target === 'class') return { class_id: Number(form.classId) }
    if (form.target === 'students') return { student_ids: form.studentIds }
    return { section_id: Number(form.sectionKey.split(':')[1]) }
  }

  async function send(e) {
    e.preventDefault()
    const problem = fileProblem(file)
    if (problem) return setError(problem)
    if (form.target === 'students' && !form.studentIds.length) return setError('Choose at least one student.')
    setBusy(true)
    setError('')
    try {
      const sent = await api('/messages', {
        method: 'POST', body: { title: form.title.trim(), body: form.body.trim(), ...targetBody() },
      })
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        try {
          await api(`/messages/${sent.id}/attachment`, { method: 'POST', formData: fd })
        } catch (err) {
          alert(`The message was sent, but the file could not be attached: ${err.message}`)
        }
      }
      onSent()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const targets = [['section', 'A section'], ['students', 'Some students']]
  if (manager) targets.push(['class', 'A whole class'], ['school', 'All students'])

  return (
    <Modal title="New message to parents" onClose={onClose} error={error} wide>
      <form onSubmit={send} className="grid">
        <Field label="Send to">
          <div className="tabs mb-0">
            {targets.map(([v, l]) => (
              <button key={v} type="button" className={form.target === v ? 'active' : ''} onClick={() => set({ target: v })}>{l}</button>
            ))}
          </div>
        </Field>
        {(form.target === 'section' || form.target === 'students') && (
          <Field label="Section">
            <select value={form.sectionKey} required onChange={(e) => set({ sectionKey: e.target.value, studentIds: [] })}>
              <option value="">Choose…</option>
              {sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
        )}
        {form.target === 'class' && (
          <Field label="Class">
            <select value={form.classId} required onChange={(e) => set({ classId: e.target.value })}>
              <option value="">Choose…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {form.target === 'students' && students.length > 0 && (
          <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border border-line p-2.5 md:grid-cols-2">
            {students.map((s) => (
              <label key={s.id} className="mb-0 flex items-center gap-2 font-normal text-ink">
                <input type="checkbox" className="w-auto" checked={form.studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                {s.roll_no ? `${s.roll_no}. ` : ''}{s.full_name}
              </label>
            ))}
          </div>
        )}
        <Field label="Title *">
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} required maxLength={150}
            placeholder="e.g. PTM on Saturday" />
        </Field>
        <Field label="Message *">
          <textarea rows={4} value={form.body} onChange={(e) => set({ body: e.target.value })} required maxLength={4000} />
        </Field>
        <FileField file={file} onChange={setFile} />
        <button disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
      </form>
    </Modal>
  )
}

function Recipients({ message, onClose }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api(`/messages/${message.id}/recipients`).then(setRows).catch((e) => { setRows([]); setError(e.message) })
  }, [message.id])
  return (
    <Modal title={`Who received "${message.title}"`} onClose={onClose} error={error}>
      {!rows ? <div className="skeleton">Loading…</div> : rows.length === 0 ? <Empty text="No recipients." /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Class</th><th>Read</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student_id}>
                  <td>{r.full_name}</td>
                  <td className="muted">{[r.class_name, r.section_name].filter(Boolean).join(' — ') || '—'}</td>
                  <td>{r.read_at ? <span className="badge green">{fmtDateTime(r.read_at)}</span> : <span className="badge gray">Not yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
