import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, fmtDate } from '../api.js'
import { Empty, PdfModal } from '../components/ui.jsx'

const TONES = { upcoming: 'blue', ongoing: 'amber', completed: 'green' }
const PAPER_MANAGERS = ['admin', 'sub_admin', 'coordinator', 'principal']

/**
 * Exam detail — click an exam → see the classes it applies to →
 * click a class → upload/view one question paper per subject.
 */
export default function ExamDetail({ user }) {
  const { examId } = useParams()
  const navigate = useNavigate()
  const canUpload = PAPER_MANAGERS.includes(user.user_type)

  const [exam, setExam] = useState(null)
  const [classId, setClassId] = useState(null)
  const [papers, setPapers] = useState(null) // { class, subjects: [{subject, paper}] }
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState(null) // paper row
  const [uploadSubject, setUploadSubject] = useState(null)
  const fileInput = useRef(null)

  async function loadExam() {
    try {
      const e = await api(`/exams/${examId}`)
      setExam(e)
      if (e.classes.length === 1) setClassId(e.classes[0].id)
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { loadExam() }, [examId])

  async function loadPapers(cid = classId) {
    if (!cid) return
    try {
      setPapers(await api(`/exams/${examId}/classes/${cid}/papers`))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    setPapers(null)
    loadPapers()
  }, [classId, examId])

  async function onFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file || !uploadSubject) return
    try {
      const fd = new FormData()
      fd.append('subject', uploadSubject)
      fd.append('file', file)
      await api(`/exams/${examId}/classes/${classId}/papers`, { method: 'POST', formData: fd })
      loadPapers()
      loadExam()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removePaper(p) {
    if (!confirm(`Delete the ${p.subject} paper?`)) return
    try {
      await api(`/exams/${examId}/papers/${p.id}`, { method: 'DELETE' })
      loadPapers()
      loadExam()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!exam) {
    return error ? <div className="error">{error}</div> : <div className="skeleton">Loading…</div>
  }

  return (
    <>
      <div className="bc">
        <Link to="/exams">Exams</Link> › <span>{exam.name}</span>
      </div>

      <div className="page-head row center" style={{ marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <h2>{exam.name}</h2>
          <p>
            {exam.class_name || 'All classes'} · {fmtDate(exam.start_date)} → {fmtDate(exam.end_date)}{' '}
            <span className={`badge ${TONES[exam.status]}`}>{exam.status}</span>
          </p>
        </div>
        <div className="row-right fit">
          <button className="soft" onClick={() => navigate(`/exams/${examId}/results`)}>
            📋 Results
          </button>
          <button className="ghost" onClick={() => navigate('/exams')}>← Back</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      {/* classes the exam applies to */}
      <div className="card">
        <h3>Classes</h3>
        {exam.classes.length === 0 ? (
          <Empty icon="🏫" text="No classes yet." />
        ) : (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {exam.classes.map((c) => (
              <button
                key={c.id}
                className={classId === c.id ? 'fit' : 'ghost fit'}
                onClick={() => setClassId(c.id)}
              >
                {c.name} · {c.paper_count}/{c.subject_count || 0} papers
              </button>
            ))}
          </div>
        )}
      </div>

      {/* subject-wise papers for the selected class */}
      {classId && (
        <div className="card">
          <div className="row center" style={{ marginBottom: 12 }}>
            <h3 style={{ flex: 1, marginBottom: 0 }}>
              Question papers {papers ? `— ${papers.class.name}` : ''}
            </h3>
          </div>
          {!papers ? (
            <div className="skeleton">Loading…</div>
          ) : papers.subjects.length === 0 ? (
            <Empty
              icon="📚"
              text="This class has no subjects yet — add them on the Classes page (✏️ Subjects)."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th><th>Paper</th><th>Uploaded by</th><th style={{ textAlign: 'right' }} />
                  </tr>
                </thead>
                <tbody>
                  {papers.subjects.map(({ subject, paper }) => (
                    <tr key={subject}>
                      <td style={{ fontWeight: 600 }}>{subject}</td>
                      <td>
                        {paper ? (
                          <button className="filelink" onClick={() => setViewing(paper)}>
                            📄 {paper.paper_name}
                          </button>
                        ) : (
                          <span className="badge gray">Not uploaded</span>
                        )}
                      </td>
                      <td className="small">
                        {paper ? `${paper.uploaded_by_name} · ${fmtDate(paper.created_at)}` : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {canUpload && (
                          <>
                            <button
                              className="ghost"
                              style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }}
                              onClick={() => { setUploadSubject(subject); fileInput.current?.click() }}
                            >
                              {paper ? 'Replace' : 'Upload PDF'}
                            </button>
                            {paper && (
                              <button className="danger" onClick={() => removePaper(paper)}>
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <input ref={fileInput} type="file" accept="application/pdf" hidden onChange={onFile} />

      {viewing && (
        <PdfModal
          path={`/exams/${examId}/papers/${viewing.id}/file`}
          title={`${exam.name} — ${viewing.subject} (${papers?.class?.name})`}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  )
}
