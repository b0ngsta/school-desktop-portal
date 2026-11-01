import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { DateInput, Field } from '../components/ui.jsx'

export default function LessonPlanForm({ user }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [assignments, setAssignments] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState([])
  const [drag, setDrag] = useState(false)
  const fileInput = useRef(null)

  const [form, setForm] = useState({
    section_key: '', // "classId:sectionId"
    heading: '',
    duration_start: '',
    duration_end: '',
    final_remark: '',
  })

  useEffect(() => {
    api('/assignments/mine')
      .then((a) => {
        setAssignments(a)
        const pre = `${params.get('class_id')}:${params.get('section_id')}`
        if (a.some((x) => `${x.class_id}:${x.section_id}` === pre)) {
          setForm((f) => ({ ...f, section_key: pre }))
        } else if (a.length === 1) {
          setForm((f) => ({ ...f, section_key: `${a[0].class_id}:${a[0].section_id}` }))
        }
      })
      .catch((e) => setError(e.message))
  }, [])

  // dedupe class/section options (teacher may have 2 roles in same section)
  const options = [...new Map(
    assignments.map((a) => [`${a.class_id}:${a.section_id}`, a])
  ).values()]

  function addFiles(list) {
    const ok = [...list].filter(
      (f) => /^image\//.test(f.type) || f.type === 'application/pdf'
    )
    setFiles((prev) => [...prev, ...ok])
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const [classId, sectionId] = form.section_key.split(':')
      const fd = new FormData()
      fd.append('class_id', classId)
      fd.append('section_id', sectionId)
      fd.append('heading', form.heading)
      if (form.duration_start) fd.append('duration_start', form.duration_start)
      if (form.duration_end) fd.append('duration_end', form.duration_end)
      if (form.final_remark) fd.append('final_remark', form.final_remark)
      files.forEach((f) => fd.append('files', f))
      await api('/lessons', { method: 'POST', formData: fd })
      navigate('/lesson-plans')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <>
      <button className="link" onClick={() => navigate(-1)}>← Back</button>
      <div className="page-head" style={{ marginTop: 8 }}>
        <h2>Add Lesson Plan</h2>
        <p>Share what you'll be teaching — visible to the admin & principal.</p>
      </div>
      {error && <div className="error">{error}</div>}

      <form className="card" onSubmit={submit} style={{ maxWidth: 720 }}>
        <div className="grid">
          <div className="grid cols-2">
            <Field label="Class — Section">
              <select
                value={form.section_key}
                onChange={(e) => setForm({ ...form, section_key: e.target.value })}
                required
              >
                <option value="">Select…</option>
                {options.map((a) => (
                  <option key={a.id} value={`${a.class_id}:${a.section_id}`}>
                    {a.class_name} — {a.section_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Heading">
              <input
                value={form.heading}
                onChange={(e) => setForm({ ...form, heading: e.target.value })}
                placeholder="e.g. Chapter 5: The Little Red Hen"
                required
              />
            </Field>
            <Field label="Duration — from">
              <DateInput value={form.duration_start}
                onChange={(e) => setForm({ ...form, duration_start: e.target.value })} />
            </Field>
            <Field label="Duration — to">
              <DateInput value={form.duration_end}
                onChange={(e) => setForm({ ...form, duration_end: e.target.value })} />
            </Field>
          </div>

          <div>
            <label>Files (photos or PDFs)</label>
            <div
              className={`dropzone ${drag ? 'drag' : ''}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
            >
              📎 Drag & drop files here, or click to browse
              <div className="small" style={{ marginTop: 4 }}>PDF, JPG, PNG, WEBP · max 10 MB each</div>
            </div>
            <input ref={fileInput} type="file" multiple accept=".pdf,image/*" hidden
              onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            {files.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {files.map((f, i) => (
                  <span className="badge gray" key={i}>
                    {f.type === 'application/pdf' ? '📄' : '🖼️'} {f.name}
                    <button type="button" className="icon" style={{ padding: '0 2px' }}
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <Field label="Final remark">
            <textarea rows={3} value={form.final_remark}
              placeholder="e.g. Students will understand the moral of hard work…"
              onChange={(e) => setForm({ ...form, final_remark: e.target.value })} />
          </Field>

          <div className="row">
            <button disabled={busy}>{busy ? 'Saving…' : 'Save lesson plan'}</button>
            <button type="button" className="ghost fit" onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </div>
      </form>
    </>
  )
}
