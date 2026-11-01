import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MANAGERS, api, uploadUserPhoto } from '../api.js'
import ClassHomework from '../components/ClassHomework.jsx'
import { Avatar, DateInput, EmailInput, Empty, ErrorBox, Field, Modal, PhotoPicker } from '../components/ui.jsx'
import { blanksToNull } from '../lib/validators.js'

const EMPTY = {
  username: '', password: '', full_name: '', email: '', phone: '',
  roll_no: '', admission_no: '', dob: '', father_name: '', mother_name: '',
  guardian_phone: '', address: '',
}

export default function SectionPage({ user }) {
  const { classId, sectionId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'homework' ? 'homework' : 'students'
  const [students, setStudents] = useState(null)
  const [meta, setMeta] = useState(null) // {className, sectionName, classTeacher}
  const [myAssignments, setMyAssignments] = useState([])
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const isManager = MANAGERS.includes(user.user_type)
  const isTeacher = user.user_type === 'teacher'
  const assignedHere = myAssignments.filter(
    (a) => a.class_id === Number(classId) && a.section_id === Number(sectionId)
  )
  const canEdit =
    isManager || assignedHere.some((a) => a.role === 'class_teacher')
  const canAddLessonPlan = isTeacher && assignedHere.length > 0
  const canGiveHomework = isManager || assignedHere.length > 0

  async function load() {
    try {
      const [studentList, classes] = await Promise.all([
        api(`/students?class_id=${classId}&section_id=${sectionId}`),
        api('/classes'),
      ])
      setStudents(studentList)
      const cls = classes.find((c) => c.id === Number(classId))
      const sec = cls?.sections.find((s) => s.id === Number(sectionId))
      setMeta({
        className: cls?.name || `Class ${classId}`,
        sectionName: sec?.name || sectionId,
        classTeacher: sec?.class_teacher,
        subjects: cls?.subjects || [],
      })
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
    if (isTeacher) api('/assignments/mine').then(setMyAssignments).catch(() => {})
  }, [classId, sectionId])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      const body = {
        ...blanksToNull(form), password: form.password,
        class_id: Number(classId), section_id: Number(sectionId),
      }
      const created = await api('/students', { method: 'POST', body })
      setForm(EMPTY)
      setPhoto(null)
      setAdding(false)
      if (photo) {
        // the student exists now: a photo problem must not look like a failed add
        await uploadUserPhoto(created.id, photo).catch((err) =>
          setError(`Student added, but the photo was not saved: ${err.message}`))
      }
      load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <button className="link" onClick={() => navigate(-1)}>← Back</button>
          <h2 style={{ marginTop: 6 }}>
            {meta ? `${meta.className} — Section ${meta.sectionName}` : 'Section'}
          </h2>
          <p>
            {meta?.classTeacher ? `Class teacher: ${meta.classTeacher}` : 'No class teacher assigned yet.'}
          </p>
        </div>
        <div className="row-right fit">
          {canAddLessonPlan && (
            <Link to={`/lesson-plans/new?class_id=${classId}&section_id=${sectionId}`}>
              <button className="soft">📚 Add lesson plan</button>
            </Link>
          )}
          {canEdit && (
            <Link to={`/users/import?user_type=student&class_id=${classId}&section_id=${sectionId}`}>
              <button className="soft">⬆️ Import from Excel</button>
            </Link>
          )}
          {canEdit && <button onClick={() => { setFormError(''); setAdding(true) }}>+ Add student</button>}
        </div>
      </div>
      <ErrorBox error={error} />

      <div className="tabs">
        {[['students', '🧑‍🎓 Students'], ['homework', '📝 Homework']].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''}
            onClick={() => setParams(id === 'students' ? {} : { tab: id }, { replace: true })}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'homework' && (
        <ClassHomework classId={classId} sectionId={sectionId} subjects={meta?.subjects || []}
          canAssign={canGiveHomework} />
      )}

      {tab === 'students' && <div className="card">
        {!students ? (
          <div className="skeleton">Loading…</div>
        ) : students.length === 0 ? (
          <Empty icon="🧑‍🎓" text="No students in this section yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Roll</th><th>Name</th><th>Father's name</th><th>Phone</th><th>Email</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => navigate(`/students/${s.id}`)}>
                    <td>{s.roll_no || '—'}</td>
                    <td>
                      <div className="row center" style={{ gap: 10, flexWrap: 'nowrap' }}>
                        <Avatar name={s.full_name} photo={s.photo_path} size={30} />
                        <span style={{ fontWeight: 600, color: 'var(--brand)' }}>{s.full_name}</span>
                      </div>
                    </td>
                    <td>{s.father_name || '—'}</td>
                    <td>{s.phone || s.guardian_phone || '—'}</td>
                    <td>{s.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {adding && (
        <Modal title="Add student" onClose={() => setAdding(false)} wide>
          <form onSubmit={submit} className="grid">
            <div className="grid cols-3">
              <Field label="Full name">
                <input value={form.full_name} onChange={set('full_name')} required />
              </Field>
              <Field label="Username (for parent app login)">
                <input value={form.username} onChange={set('username')} required minLength={3} />
              </Field>
              <Field label="Password">
                <input value={form.password} onChange={set('password')} required minLength={6} />
              </Field>
              <Field label="Roll no">
                <input value={form.roll_no} onChange={set('roll_no')} />
              </Field>
              <Field label="Admission no">
                <input value={form.admission_no} onChange={set('admission_no')} />
              </Field>
              <Field label="Date of birth">
                <DateInput value={form.dob} onChange={set('dob')} />
              </Field>
              <Field label="Father's name">
                <input value={form.father_name} onChange={set('father_name')} />
              </Field>
              <Field label="Mother's name">
                <input value={form.mother_name} onChange={set('mother_name')} />
              </Field>
              <Field label="Guardian phone">
                <input value={form.guardian_phone} onChange={set('guardian_phone')} />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={set('phone')} />
              </Field>
              <Field label="Email">
                <EmailInput value={form.email} onChange={set('email')} placeholder="parent@email.com" />
              </Field>
              <Field label="Address">
                <input value={form.address} onChange={set('address')} />
              </Field>
              <PhotoPicker file={photo} onChange={setPhoto} />
            </div>
            <ErrorBox error={formError} className="mb-0" />
            <button disabled={busy}>{busy ? 'Adding…' : 'Add student'}</button>
          </form>
        </Modal>
      )}
    </>
  )
}
