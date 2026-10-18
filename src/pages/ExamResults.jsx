import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MANAGERS, api, fmtDate } from '../api.js'
import { Avatar, Empty, PdfModal } from '../components/ui.jsx'

const TONES = { upcoming: 'blue', ongoing: 'amber', completed: 'green' }

export default function ExamResults({ user }) {
  const { examId } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [sectionId, setSectionId] = useState(null)
  const [rows, setRows] = useState(null)
  const [myAssignments, setMyAssignments] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showPaper, setShowPaper] = useState(false)

  const isManager = MANAGERS.includes(user.user_type)

  useEffect(() => {
    api(`/exams/${examId}`)
      .then((e) => {
        setExam(e)
        if (e.sections.length === 1) setSectionId(e.sections[0].id)
      })
      .catch((e) => setError(e.message))
    if (user.user_type === 'teacher') {
      api('/assignments/mine').then(setMyAssignments).catch(() => {})
    }
  }, [examId])

  useEffect(() => {
    if (!sectionId) return
    setRows(null)
    setSaved(false)
    api(`/exams/${examId}/results?section_id=${sectionId}`)
      .then((d) => setRows(d.rows.map((r) => ({ ...r, marks: r.marks ?? '', grade: r.grade ?? '' }))))
      .catch((e) => setError(e.message))
  }, [sectionId, examId])

  const canEdit = isManager || myAssignments.some((a) => a.section_id === sectionId)

  async function save() {
    setSaving(true)
    setError('')
    try {
      await api(`/exams/${examId}/results`, {
        method: 'PUT',
        body: {
          section_id: sectionId,
          results: rows.map((r) => ({
            student_id: r.student_id,
            marks: r.marks === '' ? null : Number(r.marks),
            grade: r.grade || null,
          })),
        },
      })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!exam) {
    return error ? <div className="error">{error}</div> : <div className="skeleton">Loading…</div>
  }

  const awaiting = exam.status === 'completed'

  return (
    <>
      <div className="bc">
        <Link to="/exams">Exams</Link> ›
        <Link to={`/exams/${examId}`}>{exam.name}</Link> ›
        <span>Results</span>
      </div>

      <div className="page-head row center" style={{ marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <h2>{exam.name}</h2>
          <p>
            {exam.class_name || 'All classes'} · {fmtDate(exam.start_date)} → {fmtDate(exam.end_date)}{' '}
            <span className={`badge ${TONES[exam.status]}`}>{exam.status}</span>{' '}
            {exam.results_published ? (
              <span className="badge green">Results published</span>
            ) : (
              <span className="badge gray">Results not published</span>
            )}
          </p>
        </div>
        <div className="row-right fit">
          {exam.paper_path && (
            <button className="soft" onClick={() => setShowPaper(true)}>📄 Exam paper</button>
          )}
          <button className="ghost" onClick={() => navigate(`/exams/${examId}`)}>← Back</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      {/* section picker */}
      <div className="card">
        <h3>Sections — {exam.class_name || 'All classes'}</h3>
        {exam.sections.length === 0 ? (
          <Empty icon="🏫" text="This class has no sections." />
        ) : (
          <div className="row">
            {exam.sections.map((s) => (
              <button key={s.id} className={sectionId === s.id ? 'fit' : 'ghost fit'}
                onClick={() => setSectionId(s.id)}>
                {exam.class_id == null ? `${s.class_name} — ` : ''}Section {s.name} · {s.student_count} 🧑‍🎓
              </button>
            ))}
          </div>
        )}
      </div>

      {sectionId && (
        <div className="card">
          <div className="row center" style={{ marginBottom: 12 }}>
            <h3 style={{ flex: 1, marginBottom: 0 }}>Results</h3>
            {canEdit && rows && (
              <>
                {saved && <span className="badge green fit">Saved ✓</span>}
                <button className="fit" disabled={saving} onClick={save}>
                  {saving ? 'Saving…' : 'Save results'}
                </button>
              </>
            )}
          </div>
          {!rows ? (
            <div className="skeleton">Loading…</div>
          ) : rows.length === 0 ? (
            <Empty icon="🧑‍🎓" text="No students in this section." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Roll</th><th>Student</th><th>Marks</th><th>Grade</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const hasResult = r.marks !== '' || r.grade
                    return (
                      <tr key={r.student_id}>
                        <td>{r.roll_no || '—'}</td>
                        <td>
                          <div className="row center" style={{ gap: 10, flexWrap: 'nowrap' }}>
                            <Avatar name={r.full_name} photo={r.photo_path} size={30} />
                            <Link to={`/students/${r.student_id}`}
                              style={{ fontWeight: 600, color: 'var(--brand)' }}>
                              {r.full_name}
                            </Link>
                          </div>
                        </td>
                        <td style={{ maxWidth: 110 }}>
                          {canEdit ? (
                            <input type="number" step="0.5" min="0" value={r.marks}
                              placeholder="—"
                              onChange={(e) => {
                                const next = rows.slice()
                                next[i] = { ...r, marks: e.target.value }
                                setRows(next)
                              }} />
                          ) : (
                            <b>{r.marks === '' ? '—' : r.marks}</b>
                          )}
                        </td>
                        <td style={{ maxWidth: 90 }}>
                          {canEdit ? (
                            <input value={r.grade} placeholder="—" maxLength={10}
                              onChange={(e) => {
                                const next = rows.slice()
                                next[i] = { ...r, grade: e.target.value }
                                setRows(next)
                              }} />
                          ) : (
                            r.grade ? <span className="grade-pill">{r.grade}</span> : '—'
                          )}
                        </td>
                        <td>
                          {hasResult ? (
                            <span className="badge green">Result stored</span>
                          ) : awaiting ? (
                            <span className="badge amber">Result awaiting</span>
                          ) : (
                            <span className="badge gray">{exam.status}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showPaper && (
        <PdfModal path={`/exams/${examId}/paper`}
          title={`${exam.name} — Question paper`}
          onClose={() => setShowPaper(false)} />
      )}
    </>
  )
}
