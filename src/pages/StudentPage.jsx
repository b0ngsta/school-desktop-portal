import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MANAGERS, api, fmtDate, fmtDateTime, uploadUserPhoto } from '../api.js'
import { Avatar, EmailInput, Empty, ErrorBox, Field, Modal, StatusBadge } from '../components/ui.jsx'
import { blanksToNull } from '../lib/validators.js'

export default function StudentPage({ user }) {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [myAssignments, setMyAssignments] = useState([])
  const [tab, setTab] = useState('overview')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)
  const photoInput = useRef(null)

  const isTeacher = user.user_type === 'teacher'
  const canEditProfile =
    MANAGERS.includes(user.user_type) ||
    myAssignments.some(
      (a) =>
        a.class_id === student?.class_id &&
        a.section_id === student?.section_id &&
        a.role === 'class_teacher'
    )

  async function load() {
    try {
      setStudent(await api(`/students/${studentId}`))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
    if (isTeacher) api('/assignments/mine').then(setMyAssignments).catch(() => {})
  }, [studentId])

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setEditError('')
    try {
      await api(`/students/${studentId}`, { method: 'PUT', body: blanksToNull(editing) })
      setEditing(null)
      load()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function changePhoto(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      await uploadUserPhoto(studentId, file)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!student) {
    return error ? <div className="error">{error}</div> : <div className="skeleton">Loading…</div>
  }

  return (
    <>
      <div className="bc">
        <button className="link" onClick={() => navigate(-1)}>←</button>
        <Link to={isTeacher ? '/my-classes' : '/classes'}>{student.class_name || 'Classes'}</Link> ›
        {student.class_id && student.section_id ? (
          <Link to={`/classes/${student.class_id}/sections/${student.section_id}`}>
            Section {student.section_name}
          </Link>
        ) : (
          <span>—</span>
        )}
        › <span>{student.full_name}</span>
      </div>

      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}

      {/* header card */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row center">
          <div className="fit" style={{ position: 'relative' }}>
            <Avatar name={student.full_name} photo={student.photo_path} size={64} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div className="row center" style={{ gap: 10 }}>
              <h2 style={{ fontSize: 20 }}>{student.full_name}</h2>
              <span className={`badge ${student.is_active ? 'green' : 'red'} fit`}>
                {student.is_active ? '● Active' : 'Inactive'}
              </span>
            </div>
            <div className="muted small" style={{ marginTop: 3 }}>
              {student.class_name} — Section {student.section_name}
              {student.roll_no ? ` · Roll No. ${student.roll_no}` : ''}
              {student.admission_no ? ` · ID: ${student.admission_no}` : ''}
            </div>
          </div>
          {canEditProfile && (
            <div className="row-right fit" style={{ display: 'flex', gap: 8 }}>
              <button className="ghost" onClick={() => photoInput.current?.click()}>
                📷 Photo
              </button>
              <button className="ghost" onClick={() => {
                setEditError('')
                setEditing({
                  full_name: student.full_name, email: student.email || '',
                  phone: student.phone || '', roll_no: student.roll_no || '',
                  admission_no: student.admission_no || '', dob: student.dob || '',
                  father_name: student.father_name || '', mother_name: student.mother_name || '',
                  guardian_phone: student.guardian_phone || '', address: student.address || '',
                })
              }}>
                ✏️ Edit
              </button>
            </div>
          )}
        </div>
        <div className="grid cols-3" style={{ marginTop: 16 }}>
          {[
            ['✉️ Email', student.email], ['📞 Phone', student.phone || student.guardian_phone],
            ["👨 Father's Name", student.father_name],
            ["👩 Mother's Name", student.mother_name],
            ['🎂 Date of Birth', fmtDate(student.dob)], ['🏠 Address', student.address],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="muted small" style={{ fontWeight: 600 }}>{k}</div>
              <div style={{ fontWeight: 600 }}>{v || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      <input ref={photoInput} type="file" accept="image/*" hidden onChange={changePhoto} />

      <div className="tabs">
        {[
          ['overview', 'Overview'], ['homework', 'Homework'], ['reports', 'Report Card'],
          ['remarks', 'Remarks'], ['attendance', 'Attendance'],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab studentId={studentId} goTo={setTab} />}
      {tab === 'homework' && <HomeworkTab studentId={studentId} />}
      {tab === 'reports' && <ReportsTab studentId={studentId} />}
      {tab === 'remarks' && <RemarksTab studentId={studentId} />}
      {tab === 'attendance' && <AttendanceTab studentId={studentId} />}

      {editing && (
        <Modal title="Edit student profile" onClose={() => setEditing(null)} wide>
          <form onSubmit={saveProfile} className="grid">
            <div className="grid cols-3">
              {[
                ['full_name', 'Full name'], ['roll_no', 'Roll no'], ['admission_no', 'Admission no'],
                ['father_name', "Father's name"], ['mother_name', "Mother's name"],
                ['guardian_phone', 'Guardian phone'], ['phone', 'Phone'], ['address', 'Address'],
              ].map(([k, label]) => (
                <Field key={k} label={label}>
                  <input value={editing[k]} required={k === 'full_name'}
                    onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} />
                </Field>
              ))}
              <Field label="Email">
                <EmailInput value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </Field>
              <Field label="Date of birth">
                <input type="date" value={editing.dob || ''}
                  onChange={(e) => setEditing({ ...editing, dob: e.target.value })} />
              </Field>
            </div>
            <ErrorBox error={editError} className="mb-0" />
            <button disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </form>
        </Modal>
      )}
    </>
  )
}

/* ---------------- overview ---------------- */
function OverviewTab({ studentId, goTo }) {
  const [homework, setHomework] = useState(null)
  const [reports, setReports] = useState(null)
  const [remarks, setRemarks] = useState(null)

  useEffect(() => {
    api(`/students/${studentId}/homework`).then(setHomework).catch(() => setHomework([]))
    api(`/students/${studentId}/report-cards`).then(setReports).catch(() => setReports([]))
    api(`/students/${studentId}/remarks`).then(setRemarks).catch(() => setRemarks([]))
  }, [studentId])

  const latestGrades = reports?.[0]?.grades

  return (
    <>
      <div className="grid cols-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>📝 Homework Status</h3>
          {!homework ? (
            <div className="skeleton">Loading…</div>
          ) : homework.length === 0 ? (
            <Empty icon="📝" text="No homework entries." />
          ) : (
            <>
              {homework.slice(0, 3).map((h) => (
                <div className="list-item row center" key={h.id}>
                  <div style={{ flex: 1 }}>
                    <b>{h.title}</b>
                    {h.note && <div className="muted small">{h.note}</div>}
                  </div>
                  <StatusBadge status={h.status} />
                </div>
              ))}
              <button className="link" style={{ marginTop: 10 }} onClick={() => goTo('homework')}>
                View all
              </button>
            </>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <h3>🎓 Grades {reports?.[0] ? `· ${reports[0].term}` : ''}</h3>
          {!reports ? (
            <div className="skeleton">Loading…</div>
          ) : !latestGrades || Object.keys(latestGrades).length === 0 ? (
            <Empty icon="🎓" text="No report card yet." />
          ) : (
            <>
              {Object.entries(latestGrades).map(([sub, g]) => (
                <div className="list-item row center" key={sub}>
                  <div style={{ flex: 1, fontWeight: 600 }}>{sub}</div>
                  <span className="grade-pill">{String(g)}</span>
                </div>
              ))}
              <button className="link" style={{ marginTop: 10 }} onClick={() => goTo('reports')}>
                View all
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>💬 Recent Remarks</h3>
        {!remarks ? (
          <div className="skeleton">Loading…</div>
        ) : remarks.length === 0 ? (
          <Empty icon="💬" text="No remarks yet." />
        ) : (
          <>
            {remarks.slice(0, 2).map((r) => (
              <div className="list-item" key={r.id}>
                <b>{r.created_by_name}</b>
                <div style={{ marginTop: 2 }}>{r.remark}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{fmtDateTime(r.created_at)}</div>
              </div>
            ))}
            <button className="link" style={{ marginTop: 10 }} onClick={() => goTo('remarks')}>
              View all
            </button>
          </>
        )}
      </div>
    </>
  )
}

/* ---------------- homework ---------------- */
function HomeworkTab({ studentId }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', due_date: '', status: 'pending', note: '' })

  const load = () =>
    api(`/students/${studentId}/homework`).then(setItems).catch((e) => setError(e.message))
  useEffect(() => { load() }, [studentId])

  async function add(e) {
    e.preventDefault()
    setError('')
    try {
      await api(`/students/${studentId}/homework`, {
        method: 'POST',
        body: { ...form, due_date: form.due_date || null, note: form.note || null },
      })
      setForm({ title: '', due_date: '', status: 'pending', note: '' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function setStatus(hw, status) {
    try {
      await api(`/students/${studentId}/homework/${hw.id}`, { method: 'PUT', body: { status } })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this homework entry?')) return
    try {
      await api(`/students/${studentId}/homework/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h3>Add homework entry</h3>
        <form onSubmit={add} className="row">
          <Field label="Title">
            <input value={form.title} required
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Due date">
            <input type="date" value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="late">Late</option>
            </select>
          </Field>
          <Field label="Note (visible to parents)">
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <button className="fit">Add</button>
        </form>
      </div>
      <div className="card">
        {!items ? (
          <div className="skeleton">Loading…</div>
        ) : items.length === 0 ? (
          <Empty icon="📝" text="No homework entries yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Title</th><th>Due</th><th>Status</th><th>Note</th><th>By</th><th /></tr>
              </thead>
              <tbody>
                {items.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600 }}>{h.title}</td>
                    <td>{fmtDate(h.due_date)}</td>
                    <td>
                      <select value={h.status} style={{ width: 130 }}
                        onChange={(e) => setStatus(h, e.target.value)}>
                        <option value="pending">Pending</option>
                        <option value="submitted">Submitted</option>
                        <option value="late">Late</option>
                      </select>
                    </td>
                    <td>{h.note || '—'}</td>
                    <td className="muted">{h.created_by_name}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="danger" onClick={() => remove(h.id)}>Delete</button>
                    </td>
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

/* ---------------- report cards ---------------- */
function ReportsTab({ studentId }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [term, setTerm] = useState('')
  const [remarks, setRemarks] = useState('')
  const [grades, setGrades] = useState([{ subject: '', grade: '' }])

  const load = () =>
    api(`/students/${studentId}/report-cards`).then(setItems).catch((e) => setError(e.message))
  useEffect(() => { load() }, [studentId])

  async function add(e) {
    e.preventDefault()
    setError('')
    try {
      const gradeObj = {}
      grades.forEach((g) => { if (g.subject) gradeObj[g.subject] = g.grade })
      await api(`/students/${studentId}/report-cards`, {
        method: 'POST',
        body: { term, grades: gradeObj, remarks: remarks || null },
      })
      setTerm(''); setRemarks(''); setGrades([{ subject: '', grade: '' }])
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this report card?')) return
    try {
      await api(`/students/${studentId}/report-cards/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  function setGrade(i, key, val) {
    const next = grades.slice()
    next[i] = { ...next[i], [key]: val }
    setGrades(next)
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h3>New report card</h3>
        <form onSubmit={add} className="grid">
          <div className="row">
            <Field label="Term">
              <input placeholder="e.g. Term 1 2026" value={term}
                onChange={(e) => setTerm(e.target.value)} required />
            </Field>
            <Field label="Overall remarks">
              <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
          </div>
          <div>
            <label>Grades</label>
            {grades.map((g, i) => (
              <div className="row" key={i} style={{ marginBottom: 8 }}>
                <input placeholder="Subject" value={g.subject}
                  onChange={(e) => setGrade(i, 'subject', e.target.value)} />
                <input placeholder="Marks / grade" value={g.grade}
                  onChange={(e) => setGrade(i, 'grade', e.target.value)} />
              </div>
            ))}
            <button type="button" className="ghost"
              onClick={() => setGrades([...grades, { subject: '', grade: '' }])}>
              + Add subject
            </button>
          </div>
          <button>Save report card</button>
        </form>
      </div>
      <div className="card">
        {!items ? (
          <div className="skeleton">Loading…</div>
        ) : items.length === 0 ? (
          <Empty icon="🎓" text="No report cards yet." />
        ) : (
          items.map((r) => (
            <div className="list-item" key={r.id}>
              <div className="row center">
                <strong style={{ flex: 1 }}>{r.term}</strong>
                <button className="danger fit" onClick={() => remove(r.id)}>Delete</button>
              </div>
              {r.grades && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {Object.entries(r.grades).map(([k, v]) => (
                    <span className="badge gray" key={k}>{k}: <b>{String(v)}</b></span>
                  ))}
                </div>
              )}
              {r.remarks && <div style={{ marginTop: 6 }}>{r.remarks}</div>}
              <div className="muted small" style={{ marginTop: 6 }}>
                {r.created_by_name} · {fmtDateTime(r.created_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}

/* ---------------- remarks ---------------- */
function RemarksTab({ studentId }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [remark, setRemark] = useState('')

  const load = () =>
    api(`/students/${studentId}/remarks`).then(setItems).catch((e) => setError(e.message))
  useEffect(() => { load() }, [studentId])

  async function add(e) {
    e.preventDefault()
    setError('')
    try {
      await api(`/students/${studentId}/remarks`, { method: 'POST', body: { remark } })
      setRemark('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this remark?')) return
    try {
      await api(`/students/${studentId}/remarks/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h3>Add remark (conveyed to parents)</h3>
        <form onSubmit={add} className="row">
          <textarea rows={2} value={remark} required placeholder="Write a remark…"
            onChange={(e) => setRemark(e.target.value)} />
          <button className="fit">Add remark</button>
        </form>
      </div>
      <div className="card">
        {!items ? (
          <div className="skeleton">Loading…</div>
        ) : items.length === 0 ? (
          <Empty icon="💬" text="No remarks yet." />
        ) : (
          items.map((r) => (
            <div className="list-item" key={r.id}>
              <div className="row center">
                <div style={{ flex: 1 }}>
                  <b>{r.created_by_name}</b>
                  <div style={{ marginTop: 2 }}>{r.remark}</div>
                </div>
                <button className="danger fit" onClick={() => remove(r.id)}>Delete</button>
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>{fmtDateTime(r.created_at)}</div>
            </div>
          ))
        )}
      </div>
    </>
  )
}

/* ---------------- attendance ---------------- */
function AttendanceTab({ studentId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/students/${studentId}/attendance`).then(setData).catch((e) => setError(e.message))
  }, [studentId])

  const TONES = { present: 'green', absent: 'red', leave: 'amber' }

  return (
    <>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <div className="row center" style={{ marginBottom: 12 }}>
          <h3 style={{ flex: 1, marginBottom: 0 }}>Attendance history</h3>
          {data?.percentage != null && (
            <span className="badge green">{data.percentage}% overall</span>
          )}
        </div>
        {!data ? (
          <div className="skeleton">Loading…</div>
        ) : data.records.length === 0 ? (
          <Empty icon="✅" text="No attendance marked yet." />
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 320 }}>
              <thead>
                <tr><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.records.map((r, i) => (
                  <tr key={i}>
                    <td>{fmtDate(r.date)}</td>
                    <td><span className={`badge ${TONES[r.status]}`}>{r.status}</span></td>
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
