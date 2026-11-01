import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { Empty } from '../components/ui.jsx'

export default function MyClasses({ user }) {
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/assignments/mine').then(setAssignments).catch((e) => setError(e.message))
  }, [])

  if (!assignments) {
    return error ? <div className="error">{error}</div> : <div className="skeleton">Loading…</div>
  }

  const classTeacher = assignments.find((a) => a.role === 'class_teacher')
  const subjects = assignments.filter((a) => a.role === 'subject_teacher')

  return (
    <>
      <div className="page-head">
        <h2>My Classes</h2>
        <p>Classes you are assigned to.</p>
      </div>
      {error && <div className="error">{error}</div>}

      {assignments.length === 0 && (
        <div className="card">
          <Empty icon="🏫" text="No class assignments yet — ask your coordinator." />
        </div>
      )}

      {/* class teacher hero */}
      {classTeacher && (
        <>
          <h3 style={{ marginBottom: 10, fontSize: 15 }}>⭐ Class Teacher</h3>
          <div className="hero">
            <div style={{ flex: 1, minWidth: 180 }}>
              <h3>{classTeacher.class_name} — {classTeacher.section_name}</h3>
              <div className="sub" style={{ marginTop: 4 }}>
                🧑‍🎓 {classTeacher.student_count} students · you manage this section
              </div>
            </div>
            <div className="btn-row">
              <button onClick={() =>
                navigate(`/classes/${classTeacher.class_id}/sections/${classTeacher.section_id}?tab=homework`)
              }>
                📝 Homework
              </button>
              <button onClick={() =>
                navigate(`/classes/${classTeacher.class_id}/sections/${classTeacher.section_id}`)
              }>
                Open Class →
              </button>
            </div>
          </div>
        </>
      )}

      {/* subject teacher grid */}
      {subjects.length > 0 && (
        <>
          <h3 style={{ marginBottom: 10, fontSize: 15 }}>📘 Subject Teacher</h3>
          <div className="grid cards">
            {subjects.map((a) => (
              <div className="card" key={a.id} style={{ marginBottom: 0 }}>
                <div className="row center" style={{ marginBottom: 8 }}>
                  <h3 style={{ flex: 1, marginBottom: 0 }}>
                    {a.class_name} — {a.section_name}
                  </h3>
                  <span className="badge blue">{a.subject || 'Subject'}</span>
                </div>
                <div className="muted small" style={{ marginBottom: 12 }}>
                  🧑‍🎓 {a.student_count} students
                </div>
                <div className="row">
                  <Link to={`/classes/${a.class_id}/sections/${a.section_id}`} style={{ flex: 1 }}>
                    <button className="soft" style={{ width: '100%' }}>View Students</button>
                  </Link>
                  <Link to={`/classes/${a.class_id}/sections/${a.section_id}?tab=homework`} className="fit">
                    <button className="ghost">📝 Homework</button>
                  </Link>
                  <Link to={`/lesson-plans/new?class_id=${a.class_id}&section_id=${a.section_id}`}
                    className="fit">
                    <button className="ghost">+ Lesson plan</button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
