import React, { useMemo, useState } from 'react'
import { api, fmtDateTime } from '../api.js'
import { AttachmentChip, FileField, fileProblem } from '../components/Attachment.jsx'
import { Empty, ErrorBox, Field, Modal, Pager } from '../components/ui.jsx'
import useMySections from '../hooks/useMySections.js'
import usePagedList from '../hooks/usePagedList.js'
import { isManager } from '../lib/roles.js'

const KINDS = {
  timetable: { label: 'Timetables', one: 'timetable', hint: 'Exam date-sheets and class timetables (PDF or photo).' },
  syllabus: { label: 'Syllabus', one: 'syllabus', hint: 'A subject’s syllabus, or the full syllabus of a class in one file (PDF or photo).' },
}

/**
 * Files parents open in the app: timetables (Time Table screen) and the
 * syllabus (Syllabus screen, one box per subject; a syllabus WITHOUT a subject
 * is the class's full syllabus → the app's "Full Syllabus" section). Managers share anything;
 * class teachers a timetable for their section; subject teachers the
 * syllabus of a class they teach.
 */
export default function Documents({ user }) {
  const manager = isManager(user.user_type)
  const { classes } = useMySections(user)
  const [kind, setKind] = useState('timetable')
  const list = usePagedList(`/documents?kind=${kind}`, 20)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  async function remove(d) {
    if (!confirm(`Delete "${d.title}"? Parents will no longer see it.`)) return
    try {
      await api(`/documents/${d.id}`, { method: 'DELETE' })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const mine = (d) => manager || d.created_by === user.id
  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Timetables & syllabus</h2>
          <p>{KINDS[kind].hint} Parents see them in the app.</p>
        </div>
        <button className="fit" onClick={() => setEditing({})}>+ Share {KINDS[kind].one}</button>
      </div>
      <div className="tabs">
        {Object.entries(KINDS).map(([id, k]) => (
          <button key={id} className={kind === id ? 'active' : ''} onClick={() => setKind(id)}>{k.label}</button>
        ))}
      </div>
      <ErrorBox error={error || list.error} />

      <div className="card">
        {!list.rows ? (
          <div className="skeleton">Loading…</div>
        ) : list.rows.length === 0 ? (
          <Empty icon="📄" text={`No ${KINDS[kind].label.toLowerCase()} shared yet.`} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>For</th><th>File</th><th>Shared</th><th /></tr></thead>
              <tbody>
                {list.rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <b>{d.title}</b>
                      {d.subject && <span className="badge gray ml-2">{d.subject}</span>}
                      {kind === 'syllabus' && !d.subject && <span className="badge blue ml-2">Full syllabus</span>}
                      {d.note && <div className="muted small">{d.note}</div>}
                    </td>
                    <td>{d.class_name ? [d.class_name, d.section_name].filter(Boolean).join(' — ') : 'Whole school'}</td>
                    <td><AttachmentChip path={d.attachment_path} name={d.attachment_name} type={d.attachment_type} /></td>
                    <td className="muted small">{d.uploaded_by || '—'}<br />{fmtDateTime(d.created_at)}</td>
                    <td className="actions">
                      {mine(d) && <>
                        <button className="ghost sm" onClick={() => setEditing(d)}>Edit</button>
                        <button className="danger sm" onClick={() => remove(d)}>Delete</button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
      </div>

      {editing && (
        <DocumentForm kind={kind} doc={editing.id ? editing : null} manager={manager} classes={classes || []}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload() }} />
      )}
    </>
  )
}

function DocumentForm({ kind, doc, manager, classes, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: doc?.title || '', note: doc?.note || '', subject: doc?.subject || '', classId: '', sectionId: '',
  })
  // syllabus: one file for every subject ("full") or one subject's syllabus
  const [scope, setScope] = useState(doc && !doc.subject ? 'full' : 'subject')
  const full = kind === 'syllabus' && scope === 'full'
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // timetable: teachers only for sections they are class teacher of; syllabus: classes they teach
  const classOptions = useMemo(() => classes
    .map((c) => ({ ...c, sections: kind === 'timetable' && !manager ? c.sections.filter((s) => s.classTeacher) : c.sections }))
    .filter((c) => manager || kind === 'syllabus' || c.sections.length), [classes, kind, manager])
  const cls = classOptions.find((c) => String(c.id) === form.classId)
  const sectionRequired = kind === 'timetable' && !manager
  const classRequired = kind === 'syllabus' && !manager

  async function save(e) {
    e.preventDefault()
    const problem = fileProblem(file)
    if (problem) return setError(problem)
    const fd = new FormData()
    fd.append('title', form.title.trim())
    fd.append('note', form.note.trim())
    if (full) fd.append('subject', '')
    else if (kind === 'syllabus' || form.subject.trim()) fd.append('subject', form.subject.trim())
    if (file) fd.append('file', file)
    if (!doc) {
      fd.append('kind', kind)
      if (form.classId) fd.append('class_id', form.classId)
      if (form.sectionId) fd.append('section_id', form.sectionId)
    }
    setBusy(true)
    setError('')
    try {
      await api(doc ? `/documents/${doc.id}` : '/documents', { method: doc ? 'PUT' : 'POST', formData: fd })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={doc ? `Edit ${KINDS[kind].one}` : `Share a ${KINDS[kind].one}`} onClose={onClose} error={error}>
      <form onSubmit={save} className="grid">
        <Field label="Title *">
          <input value={form.title} onChange={set('title')} required maxLength={150} autoFocus
            placeholder={kind === 'timetable' ? 'e.g. Half Yearly Exam 2026 — date sheet' : full ? 'e.g. Class 5 syllabus 2026-27' : 'e.g. Mathematics 2026-27'} />
        </Field>
        {!doc && (
          <div className="grid cols-2">
            <Field label={classRequired || sectionRequired ? 'Class *' : 'Class (blank = whole school)'}>
              <select value={form.classId} required={classRequired || sectionRequired}
                onChange={(e) => setForm({ ...form, classId: e.target.value, sectionId: '' })}>
                <option value="">{manager ? 'Whole school' : 'Choose…'}</option>
                {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label={sectionRequired ? 'Section *' : 'Section (blank = all sections)'}>
              <select value={form.sectionId} required={sectionRequired} disabled={!cls}
                onChange={set('sectionId')}>
                <option value="">{sectionRequired ? 'Choose…' : 'All sections'}</option>
                {(cls?.sections || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
        )}
        {kind === 'syllabus' && (
          <Field label="What is in the file?">
            <div className="tabs" role="radiogroup" style={{ marginBottom: 0 }}>
              <button type="button" role="radio" aria-checked={scope === 'subject'}
                className={scope === 'subject' ? 'active' : ''} onClick={() => setScope('subject')}>One subject</button>
              <button type="button" role="radio" aria-checked={full}
                className={full ? 'active' : ''} onClick={() => setScope('full')}>Full syllabus (all subjects)</button>
            </div>
            {full && <div className="muted small" style={{ marginTop: 6 }}>Parents see it under “Full Syllabus” in the app.</div>}
          </Field>
        )}
        {!full && (
          <Field label={kind === 'syllabus' ? 'Subject *' : 'Subject (optional)'}>
            <input value={form.subject} onChange={set('subject')} required={kind === 'syllabus'} maxLength={100}
              list="doc-subjects" />
            <datalist id="doc-subjects">{(cls?.subjects || []).map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
        )}
        <Field label="Note for parents">
          <textarea rows={2} value={form.note} onChange={set('note')} maxLength={4000} />
        </Field>
        {doc && <div><AttachmentChip path={doc.attachment_path} name={doc.attachment_name} type={doc.attachment_type} label="Current file" /></div>}
        <FileField file={file} onChange={setFile} required={!doc}
          label={doc ? 'Replace the file (optional)' : 'File * (PDF or photo, up to 15 MB)'} />
        <button disabled={busy}>{busy ? 'Saving…' : doc ? 'Save changes' : 'Share'}</button>
      </form>
    </Modal>
  )
}
