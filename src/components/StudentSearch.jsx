import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Avatar, Field } from './ui.jsx'

/**
 * Pick one student by typing part of a name, username, admission or roll
 * number (GET /students?q=…, 20 at a time) instead of loading every student
 * of the school into a dropdown.
 */
export default function StudentSearch({ value, onChange, label = 'Student', required = true }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [picked, setPicked] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults(null); return undefined }
    let live = true
    const timer = setTimeout(() => {
      api(`/students?q=${encodeURIComponent(q)}&limit=20`)
        .then((rows) => { if (live) { setResults(rows); setError('') } })
        .catch((e) => { if (live) setError(e.message) })
    }, 250)
    return () => { live = false; clearTimeout(timer) }
  }, [query])

  const describe = (s) => `${s.full_name}${s.class_name ? ` (${s.class_name} ${s.section_name || ''})` : ''}`

  if (value && picked) {
    return (
      <Field label={label}>
        <div className="row center" style={{ gap: 8 }}>
          <b style={{ flex: 1 }}>{describe(picked)}</b>
          <button type="button" className="ghost" onClick={() => { setPicked(null); onChange('') }}>Change</button>
        </div>
      </Field>
    )
  }
  return (
    <Field label={label}>
      <input value={query} placeholder="Type a name, admission or roll number…" autoFocus
        onChange={(e) => setQuery(e.target.value)} />
      {/* keeps the form's "required" check: empty until a student is picked */}
      <input value={value} required={required} readOnly tabIndex={-1} aria-hidden="true"
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} />
      {error && <div className="error small">{error}</div>}
      {results && (
        results.length === 0 ? <p className="muted small">No student matches “{query.trim()}”.</p> : (
          <div className="search-results" style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6 }}>
            {results.map((s) => (
              <button type="button" key={s.id} className="ghost"
                style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', gap: 10 }}
                onClick={() => { setPicked(s); onChange(String(s.id)) }}>
                <Avatar name={s.full_name} photo={s.photo_path} size={26} />
                <span>{describe(s)}{s.admission_no ? <span className="muted small"> · {s.admission_no}</span> : null}</span>
              </button>
            ))}
          </div>
        )
      )}
    </Field>
  )
}
