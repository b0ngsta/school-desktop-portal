import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MANAGERS, api, fetchFile, fmtDate } from '../api.js'
import { saveBlob } from '../lib/format.js'
import { Avatar, Empty, PdfModal } from '../components/ui.jsx'

const TONES = { upcoming: 'blue', ongoing: 'amber', completed: 'green' }

export default function ExamResults({ user }) {
  const { examId } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [sectionId, setSectionId] = useState(null)
  const [rows, setRows] = useState(null)
  // marks per subject (backend migration 0015); '' = one mark for the whole exam, as before
  const [subject, setSubject] = useState('')
  const [subjects, setSubjects] = useState(null) // null: older server, whole-exam marks only
  const [maxMarks, setMaxMarks] = useState('')
  const [myAssignments, setMyAssignments] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showPaper, setShowPaper] = useState(false)
  const [reloadKey, setReloadKey] = useState(0) // bumped after a CSV upload

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
    const q = subject ? `&subject=${encodeURIComponent(subject)}` : ''
    api(`/exams/${examId}/results?section_id=${sectionId}${q}`)
      .then((d) => {
        setRows(d.rows.map((r) => ({ ...r, marks: r.marks ?? '', grade: r.grade ?? '' })))
        setSubjects(Array.isArray(d.subjects) ? d.subjects : null)
        setMaxMarks(d.max_marks ?? '')
      })
      .catch((e) => setError(e.message))
  }, [sectionId, examId, subject, reloadKey])

  const canEdit = isManager || myAssignments.some((a) => a.section_id === sectionId)

  const max = maxMarks === '' ? null : Number(maxMarks)
  const badMark = (r) => r.marks !== '' && (Number(r.marks) < 0 || (max !== null && Number(r.marks) > max))

  async function save() {
    const bad = rows.filter(badMark)
    if (bad.length) {
      setError(`Marks must be between 0 and ${max ?? 'the maximum'}: ${bad.slice(0, 3).map((r) => r.full_name).join(', ')}`
        + (bad.length > 3 ? ` and ${bad.length - 3} more` : ''))
      return
    }
    setSaving(true)
    setError('')
    try {
      await api(`/exams/${examId}/results`, {
        method: 'PUT',
        body: {
          section_id: sectionId,
          ...(subject ? { subject } : {}),
          ...(max !== null ? { max_marks: max } : {}),
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
        <ResultsUpload examId={examId} sectionId={sectionId} reloadKey={reloadKey}
          onUploaded={() => setReloadKey((k) => k + 1)} />
      )}

      {sectionId && (
        <div className="card">
          {subjects && subjects.length > 0 && (
            <div className="row" style={{ marginBottom: 12, gap: 6 }} role="tablist" aria-label="Marks for">
              {['', ...subjects].map((name) => (
                <button key={name || 'whole'} className={subject === name ? 'fit sm' : 'ghost fit sm'}
                  role="tab" aria-selected={subject === name} onClick={() => setSubject(name)}>
                  {name || 'Whole exam'}
                </button>
              ))}
            </div>
          )}
          <div className="row center" style={{ marginBottom: 12 }}>
            <h3 style={{ flex: 1, marginBottom: 0 }}>
              {subject ? `${subject} marks` : 'Results'}
            </h3>
            {subjects && (
              <label className="row center fit small" style={{ gap: 6, flexWrap: 'nowrap' }}>
                Out of
                {canEdit ? (
                  <input type="number" min="1" step="0.5" value={maxMarks} placeholder="—"
                    style={{ width: 80 }} onChange={(e) => { setMaxMarks(e.target.value); setSaved(false) }} />
                ) : (
                  <b>{maxMarks === '' ? '—' : maxMarks}</b>
                )}
              </label>
            )}
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
                            <input type="number" step="0.5" min="0" max={max ?? undefined} value={r.marks}
                              placeholder="—" aria-invalid={badMark(r) || undefined}
                              style={badMark(r) ? { borderColor: 'var(--danger)' } : undefined}
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

/* ---------------- whole-section marks: Excel template + upload (class teacher / managers) ---------------- */
function ResultsUpload({ examId, sectionId, reloadKey, onUploaded }) {
  const [sheet, setSheet] = useState(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [problems, setProblems] = useState([])
  const [done, setDone] = useState(null)
  const [maxMarks, setMaxMarks] = useState('') // required: what every subject of this upload is out of
  const fileInput = React.useRef(null)

  useEffect(() => {
    setSheet(null)
    api(`/exams/${examId}/results/sheet?section_id=${sectionId}`)
      .then((s) => {
        setSheet(s)
        // prefill "out of" with the maximum already in use (same for every subject), else the exam's
        const maxes = [...new Set((s.subjects || []).map((x) => x.max_marks).filter((m) => m != null))]
        setMaxMarks((m) => m || String(maxes.length === 1 ? maxes[0] : s.exam?.max_marks ?? ''))
      })
      .catch(() => setSheet({ unavailable: true })) // older server: no Excel upload
  }, [examId, sectionId, reloadKey])

  useEffect(() => { setDone(null); setProblems([]); setError(''); setFile(null); setMaxMarks('') }, [sectionId])

  if (!sheet || sheet.unavailable) return null

  async function download() {
    setError('')
    try {
      const { blob, filename } = await fetchFile(`/exams/${examId}/results/template?section_id=${sectionId}`)
      saveBlob(blob, filename || 'results.xlsx')
    } catch (err) {
      setError(err.message)
    }
  }

  async function upload(e) {
    e.preventDefault()
    const max = Number(maxMarks)
    if (!maxMarks || !(max > 0)) return setError('Enter the maximum marks (out of) for this exam, e.g. 50 or 100')
    if (!file) return setError('Choose the filled-in Excel file')
    if (!/\.xlsx$/i.test(file.name)) return setError('Choose the Excel (.xlsx) file — download the template, fill it in and save it as .xlsx')
    const fd = new FormData()
    fd.append('section_id', String(sectionId))
    fd.append('max_marks', String(max))
    fd.append('file', file)
    setBusy(true)
    setError('')
    setProblems([])
    setDone(null)
    try {
      setDone(await api(`/exams/${examId}/results/import`, { method: 'POST', formData: fd }))
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      onUploaded()
    } catch (err) {
      setError(err.message)
      setProblems(err.body?.errors || [])
    } finally {
      setBusy(false)
    }
  }

  const subjects = sheet.subjects || []
  const show = (v) => (v === null || v === undefined ? '—' : v)
  return (
    <div className="card">
      <div className="row center" style={{ marginBottom: 8 }}>
        <h3 style={{ flex: 1, marginBottom: 0 }}>All subjects · {sheet.section?.class_name} {sheet.section?.section_name}</h3>
        {sheet.can_import && <button className="soft fit" onClick={download}>⬇️ Download Excel template</button>}
      </div>
      {sheet.can_import ? (
        <>
          <p className="muted small">
            Fill the Excel template: one column per subject, write <b>AB</b> for absent and leave a cell empty to keep
            it as it is. Enter the <b>maximum marks</b> below, then upload — if any cell is wrong nothing is saved and
            the rows to fix are listed. Uploaded results are <b>published</b> to parents straight away.
          </p>
          <form onSubmit={upload} className="row center" style={{ gap: 8, alignItems: 'flex-end' }}>
            <label className="small" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Maximum marks per subject *</span>
              <input type="number" min="1" step="0.5" required value={maxMarks} placeholder="e.g. 50"
                style={{ width: 140 }} aria-label="Maximum marks per subject"
                onChange={(e) => { setMaxMarks(e.target.value); setDone(null) }} />
            </label>
            <input ref={fileInput} type="file" aria-label="Results Excel file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setDone(null) }} />
            <button className="fit" disabled={busy || !file || !maxMarks}>{busy ? 'Uploading…' : '⬆️ Upload results'}</button>
          </form>
        </>
      ) : (
        <p className="muted small">Only the class teacher of this section (or the office) can upload marks from Excel.</p>
      )}
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
      {problems.length > 1 && (
        <ul className="small" style={{ marginTop: 6, paddingLeft: 18 }}>
          {problems.slice(0, 20).map((p, i) => (
            <li key={i}>Row {p.row}{p.column ? ` · ${p.column}` : ''}: {p.message}</li>
          ))}
          {problems.length > 20 && <li>…and {problems.length - 20} more</li>}
        </ul>
      )}
      {done && (
        <div className="badge green" style={{ marginTop: 10 }}>
          Saved ✓ {done.marks} marks for {done.students} students{done.absent ? ` (${done.absent} absent)` : ''} · out of {done.max_marks} · published to parents
        </div>
      )}
      {subjects.length > 0 && sheet.students?.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Roll</th><th>Student</th>
                {subjects.map((s) => <th key={s.name}>{s.name}{s.max_marks ? <span className="muted small"> /{s.max_marks}</span> : null}</th>)}
                <th>Total</th><th>%</th>
              </tr>
            </thead>
            <tbody>
              {sheet.students.map((st) => (
                <tr key={st.student_id}>
                  <td>{st.roll_no || '—'}</td>
                  <td>{st.full_name}</td>
                  {subjects.map((s) => {
                    const v = st.marks?.[s.name]
                    return <td key={s.name}>{v === 'AB' ? <span className="badge amber">AB</span> : show(v)}</td>
                  })}
                  <td><b>{st.total == null ? '—' : `${st.total}/${st.max_total}`}</b></td>
                  <td>{show(st.percentage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
