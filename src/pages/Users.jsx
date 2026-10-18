import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import {
  Avatar, EmailInput, Empty, ErrorBox, Field, Modal, Pager, PhotoPicker, StatusBadge,
} from '../components/ui.jsx'
import usePagedList from '../hooks/usePagedList.js'
import { ROLE_LABELS, canManageAccount, creatableStaffTypes, roleLabel } from '../lib/roles.js'
import { blanksToNull } from '../lib/validators.js'
import { findPrincipal, updateStaff, uploadUserPhoto } from '../services/users.js'

const PAGE_SIZE = 50

const EMPTY = {
  username: '', password: '', full_name: '', email: '', phone: '',
  user_type: 'teacher', subject: '', qualification: '', joining_date: '', address: '',
}

export default function Users({ user }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  const list = usePagedList('/users' + (filter ? `?user_type=${filter}` : ''), PAGE_SIZE)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null) // user row being edited
  const [teacherInfo, setTeacherInfo] = useState(null) // teacher id + name for the info modal
  const [assignFor, setAssignFor] = useState(null) // teacher for assignment modal

  async function remove(u) {
    if (!confirm(`Delete ${u.full_name}? This removes all their data.`)) return
    setError('')
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const users = list.rows

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Users</h2>
          <p>Staff accounts — students are added from their class section page or by CSV import.</p>
        </div>
        <div className="row-right fit">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 160 }}>
            <option value="">All staff</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{value === 'student' ? 'Students' : label}</option>
            ))}
          </select>
          <Link to="/users/import"><button className="soft">⬆️ Import CSV</button></Link>
          <button onClick={() => setCreating(true)}>+ Add user</button>
        </div>
      </div>
      <ErrorBox error={error || list.error} />

      <div className="card">
        {!users ? (
          <div className="skeleton">Loading…</div>
        ) : users.length === 0 ? (
          <Empty icon="👥" text="No users found." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Username</th><th>Role</th><th>Email</th><th>Phone</th><th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const manageable = canManageAccount(user.user_type, u.user_type)
                  const isStudent = u.user_type === 'student'
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="row center" style={{ gap: 10, flexWrap: 'nowrap' }}>
                          <Avatar name={u.full_name} photo={u.photo_path} size={30} />
                          <span style={{ fontWeight: 600 }}>{u.full_name}</span>
                        </div>
                      </td>
                      <td className="muted">{u.username}</td>
                      <td><span className="badge">{roleLabel(u.user_type)}</span></td>
                      <td>{u.email || <span className="badge amber">missing</span>}</td>
                      <td>{u.phone || '—'}</td>
                      <td className="actions">
                        {u.user_type === 'teacher' && (
                          <>
                            <button className="soft sm" onClick={() => setAssignFor(u)}>Assignments</button>
                            <button className="soft sm" onClick={() => navigate(`/teachers/${u.id}/timetable`)}>
                              🗓️ Timetable
                            </button>
                            <button className="ghost sm" onClick={() => setTeacherInfo(u)}>Info</button>
                          </>
                        )}
                        {isStudent && (
                          <button className="ghost sm" onClick={() => navigate(`/students/${u.id}`)}>Open</button>
                        )}
                        {manageable && !isStudent && (
                          <button className="ghost sm" onClick={() => setEditing(u)}>Edit</button>
                        )}
                        {manageable && u.id !== user.id && (
                          <button className="danger" onClick={() => remove(u)}>Delete</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
      </div>

      {creating && (
        <CreateUserModal actor={user} onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); list.reload() }} />
      )}
      {editing && (
        <EditUserModal target={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); list.reload() }} />
      )}
      {teacherInfo && <TeacherInfoModal teacher={teacherInfo} onClose={() => setTeacherInfo(null)} />}
      {assignFor && <AssignmentsModal teacher={assignFor} onClose={() => setAssignFor(null)} />}
    </>
  )
}

function CreateUserModal({ actor, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY)
  const [photo, setPhoto] = useState(null)
  const [principal, setPrincipal] = useState(undefined) // undefined = still checking
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const canCreatePrincipal = creatableStaffTypes(actor.user_type).includes('principal')
  useEffect(() => {
    if (!canCreatePrincipal) return
    findPrincipal().then(setPrincipal).catch(() => setPrincipal(null))
  }, [canCreatePrincipal])

  // Only one principal: hide the option while one exists (the server answers 409 anyway).
  const types = creatableStaffTypes(actor.user_type).filter((t) => t !== 'principal' || principal === null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = {
        ...blanksToNull({
          username: form.username, full_name: form.full_name, email: form.email, phone: form.phone,
        }),
        password: form.password,
        user_type: form.user_type,
      }
      if (form.user_type === 'teacher') {
        body.teacher_info = blanksToNull({
          subject: form.subject, qualification: form.qualification,
          joining_date: form.joining_date, address: form.address,
        })
      }
      const created = await api('/users', { method: 'POST', body })
      if (photo) {
        try {
          await uploadUserPhoto(created.id, photo)
        } catch (err) {
          // the account exists: don't offer to create it again
          alert(`User created, but the photo was not saved: ${err.message}`)
        }
      }
      onCreated(created)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Add staff user" onClose={onClose}>
      <form onSubmit={submit} className="grid">
        <div className="grid cols-2">
          <Field label="Role">
            <select value={form.user_type} onChange={set('user_type')}>
              {types.map((t) => <option key={t} value={t}>{roleLabel(t)}</option>)}
            </select>
          </Field>
          <Field label="Full name">
            <input value={form.full_name} onChange={set('full_name')} required maxLength={100} />
          </Field>
          <Field label="Username">
            <input value={form.username} onChange={set('username')} required minLength={3} maxLength={50}
              autoCapitalize="none" autoComplete="off" />
          </Field>
          <Field label="Password">
            <input value={form.password} onChange={set('password')} required minLength={6} maxLength={128}
              autoComplete="new-password" />
          </Field>
          <Field label="Email">
            <EmailInput value={form.email} onChange={set('email')} placeholder="name@school.in" />
          </Field>
          <Field label="Phone">
            <input type="tel" value={form.phone} onChange={set('phone')} maxLength={20} />
          </Field>
          {form.user_type === 'teacher' && (
            <>
              <Field label="Subject">
                <input value={form.subject} onChange={set('subject')} />
              </Field>
              <Field label="Qualification">
                <input value={form.qualification} onChange={set('qualification')} />
              </Field>
              <Field label="Joining date">
                <input type="date" value={form.joining_date} onChange={set('joining_date')} />
              </Field>
              <Field label="Address">
                <input value={form.address} onChange={set('address')} />
              </Field>
            </>
          )}
        </div>
        {canCreatePrincipal && principal && (
          <p className="muted small">Principal: {principal.full_name} ({principal.username}). Only one principal is allowed.</p>
        )}
        <PhotoPicker file={photo} onChange={setPhoto} />
        <ErrorBox error={error} className="mb-0" />
        <button disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
      </form>
    </Modal>
  )
}

/** Name / email / phone of a staff account (PUT /users/{id}: only changed fields are sent). */
function EditUserModal({ target, onClose, onSaved }) {
  const initial = { full_name: target.full_name || '', email: target.email || '', phone: target.phone || '' }
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    const cleaned = blanksToNull(form)
    const changes = Object.fromEntries(
      Object.entries(cleaned).filter(([k, v]) => v !== (blanksToNull(initial)[k]))
    )
    if (Object.keys(changes).length === 0) return onClose()
    setBusy(true)
    setError('')
    try {
      await updateStaff(target.id, changes)
      onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Edit ${target.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid">
        <div className="muted small">{target.username} · {roleLabel(target.user_type)}</div>
        <Field label="Full name">
          <input value={form.full_name} onChange={set('full_name')} required maxLength={100} />
        </Field>
        <Field label="Email (used for password resets)">
          <EmailInput value={form.email} onChange={set('email')} placeholder="name@school.in" />
        </Field>
        <Field label="Phone">
          <input type="tel" value={form.phone} onChange={set('phone')} maxLength={20} />
        </Field>
        <ErrorBox error={error} className="mb-0" />
        <button disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </Modal>
  )
}

function TeacherInfoModal({ teacher, onClose }) {
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/users/teachers')
      .then((all) => {
        const t = all.find((x) => x.id === teacher.id) || {}
        setInfo({
          subject: t.subject || '', qualification: t.qualification || '',
          joining_date: t.joining_date || '', address: t.address || '',
        })
      })
      .catch((e) => setError(e.message))
  }, [teacher.id])

  const set = (k) => (e) => setInfo({ ...info, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/users/teachers/${teacher.id}`, { method: 'PUT', body: blanksToNull(info) })
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Teacher info — ${teacher.full_name}`} onClose={onClose}>
      <ErrorBox error={error} />
      {!info ? (
        !error && <div className="skeleton">Loading…</div>
      ) : (
        <form onSubmit={save} className="grid">
          <div className="grid cols-2">
            <Field label="Subject"><input value={info.subject} onChange={set('subject')} /></Field>
            <Field label="Qualification"><input value={info.qualification} onChange={set('qualification')} /></Field>
            <Field label="Joining date">
              <input type="date" value={info.joining_date} onChange={set('joining_date')} />
            </Field>
            <Field label="Address"><input value={info.address} onChange={set('address')} /></Field>
          </div>
          <button disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </form>
      )}
    </Modal>
  )
}

function AssignmentsModal({ teacher, onClose }) {
  const [assignments, setAssignments] = useState(null)
  const [classes, setClasses] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ class_id: '', section_id: '', role: 'subject_teacher', subject: '' })

  async function load() {
    try {
      setAssignments(await api(`/assignments?teacher_id=${teacher.id}`))
      setClasses(await api('/classes'))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  const sections = classes.find((c) => c.id === Number(form.class_id))?.sections || []

  async function add(e) {
    e.preventDefault()
    setError('')
    try {
      await api('/assignments', {
        method: 'POST',
        body: {
          teacher_id: teacher.id,
          class_id: Number(form.class_id),
          section_id: Number(form.section_id),
          role: form.role,
          subject: form.role === 'subject_teacher' ? form.subject || null : null,
        },
      })
      setForm({ class_id: '', section_id: '', role: 'subject_teacher', subject: '' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    try {
      await api(`/assignments/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={`Class assignments — ${teacher.full_name}`} onClose={onClose} wide>
      {error && <div className="error">{error}</div>}
      <form onSubmit={add} className="row" style={{ marginBottom: 18 }}>
        <Field label="Class">
          <select value={form.class_id} required
            onChange={(e) => setForm({ ...form, class_id: e.target.value, section_id: '' })}>
            <option value="">Select…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Section">
          <select value={form.section_id} required
            onChange={(e) => setForm({ ...form, section_id: e.target.value })}>
            <option value="">Select…</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Role">
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="subject_teacher">Subject teacher</option>
            <option value="class_teacher">Class teacher</option>
          </select>
        </Field>
        {form.role === 'subject_teacher' && (
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </Field>
        )}
        <button className="fit">Assign</button>
      </form>

      {!assignments ? (
        <div className="skeleton">Loading…</div>
      ) : assignments.length === 0 ? (
        <div className="muted">No assignments yet — assign a class above.</div>
      ) : (
        <div className="table-wrap">
          <table style={{ minWidth: 420 }}>
            <thead>
              <tr><th>Class</th><th>Section</th><th>Role</th><th>Subject</th><th /></tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td>{a.class_name}</td>
                  <td>{a.section_name}</td>
                  <td><StatusBadge status={a.role} /></td>
                  <td>{a.subject || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="danger" onClick={() => remove(a.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
