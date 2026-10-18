import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { Empty, Field, Modal } from '../components/ui.jsx'

/** Chip editor: type a subject, press Enter/`,` or click + to add. */
function SubjectsInput({ subjects, setSubjects, autoFocus }) {
  const [draft, setDraft] = useState('')
  function add() {
    const name = draft.trim()
    if (!name) return
    if (!subjects.some((s) => s.toLowerCase() === name.toLowerCase())) {
      setSubjects([...subjects, name])
    }
    setDraft('')
  }
  return (
    <div>
      <div className="row" style={{ gap: 6 }}>
        <input
          value={draft}
          autoFocus={autoFocus}
          placeholder="e.g. Mathematics — press Enter to add"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          }}
        />
        <button type="button" className="soft fit" onClick={add}>+ Add</button>
      </div>
      {subjects.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {subjects.map((s) => (
            <span key={s} className="badge blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {s}
              <button
                type="button"
                onClick={() => setSubjects(subjects.filter((x) => x !== s))}
                style={{ all: 'unset', cursor: 'pointer', fontWeight: 800, lineHeight: 1 }}
                aria-label={`Remove ${s}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Classes({ user }) {
  const [classes, setClasses] = useState(null)
  const [error, setError] = useState('')
  const [addingClass, setAddingClass] = useState(false)
  const [className, setClassName] = useState('')
  const [classFee, setClassFee] = useState('')
  const [classSubjects, setClassSubjects] = useState([])
  const [subjectsFor, setSubjectsFor] = useState(null) // class object being edited
  const [editSubjects, setEditSubjects] = useState([])
  const [sectionFor, setSectionFor] = useState(null) // class object
  const [sectionName, setSectionName] = useState('')

  async function load() {
    try {
      setClasses(await api('/classes'))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  async function addClass(e) {
    e.preventDefault()
    try {
      await api('/classes', {
        method: 'POST',
        body: {
          name: className,
          fee_amount: classFee ? Number(classFee) : null,
          subjects: classSubjects,
        },
      })
      setClassName('')
      setClassFee('')
      setClassSubjects([])
      setAddingClass(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveSubjects(e) {
    e.preventDefault()
    try {
      await api(`/classes/${subjectsFor.id}/subjects`, {
        method: 'PUT',
        body: { subjects: editSubjects },
      })
      setSubjectsFor(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function addSection(e) {
    e.preventDefault()
    try {
      await api(`/classes/${sectionFor.id}/sections`, {
        method: 'POST',
        body: { name: sectionName },
      })
      setSectionName('')
      setSectionFor(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeClass(c) {
    if (!confirm(`Delete ${c.name} and all its sections?`)) return
    try {
      await api(`/classes/${c.id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeSection(c, s) {
    if (!confirm(`Delete section ${s.name}?`)) return
    try {
      await api(`/classes/${c.id}/sections/${s.id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Classes & Sections</h2>
          <p>Open a section to manage its students.</p>
        </div>
        <button className="fit" onClick={() => setAddingClass(true)}>+ Add class</button>
      </div>
      {error && <div className="error">{error}</div>}

      {!classes ? (
        <div className="skeleton">Loading…</div>
      ) : classes.length === 0 ? (
        <div className="card"><Empty icon="🏫" text="No classes yet — add your first class." /></div>
      ) : (
        <div className="grid cards">
          {classes.map((c) => (
            <div className="card" key={c.id} style={{ marginBottom: 0 }}>
              <div className="row center" style={{ marginBottom: 12 }}>
                <h3 style={{ flex: 1, marginBottom: 0 }}>{c.name}</h3>
                {c.fee_amount != null && (
                  <span className="badge green">
                    ₹{Number(c.fee_amount).toLocaleString('en-IN')} fee
                  </span>
                )}
                <button className="icon fit" title="Delete class" onClick={() => removeClass(c)}>🗑️</button>
              </div>
              <div className="row center" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {(c.subjects || []).map((s) => (
                  <span key={s} className="badge blue">{s}</span>
                ))}
                {(c.subjects || []).length === 0 && (
                  <span className="muted small">No subjects yet.</span>
                )}
                <button
                  className="ghost fit"
                  style={{ padding: '3px 9px', fontSize: 12 }}
                  onClick={() => { setSubjectsFor(c); setEditSubjects(c.subjects || []) }}
                >
                  ✏️ Subjects
                </button>
              </div>
              <div className="grid" style={{ gap: 8 }}>
                {c.sections.length === 0 && <div className="muted small">No sections yet.</div>}
                {c.sections.map((s) => (
                  <div className="row center" style={{ gap: 6 }} key={s.id}>
                    <Link
                      to={`/classes/${c.id}/sections/${s.id}`}
                      className="section-chip"
                      style={{ flex: 1 }}
                    >
                      <span>Section {s.name}</span>
                      <span className="muted small">
                        🧑‍🎓 {s.student_count}
                        {s.class_teacher ? ` · ${s.class_teacher}` : ''}
                      </span>
                    </Link>
                    <button className="icon fit" title="Delete section"
                      onClick={() => removeSection(c, s)}>✕</button>
                  </div>
                ))}
                <button className="soft" onClick={() => setSectionFor(c)}>+ Add section</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {addingClass && (
        <Modal error={error} title="Add class" onClose={() => setAddingClass(false)}>
          <form onSubmit={addClass} className="grid">
            <Field label="Class name">
              <input value={className} onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. Class 5" required autoFocus />
            </Field>
            <Field label="Standard fee for this class (₹)">
              <input type="number" min="0" step="0.01" value={classFee}
                onChange={(e) => setClassFee(e.target.value)}
                placeholder="e.g. 15000" />
            </Field>
            <Field label="Subjects taught in this class">
              <SubjectsInput subjects={classSubjects} setSubjects={setClassSubjects} />
            </Field>
            <button>Add class</button>
          </form>
        </Modal>
      )}

      {subjectsFor && (
        <Modal error={error} title={`Subjects — ${subjectsFor.name}`} onClose={() => setSubjectsFor(null)}>
          <form onSubmit={saveSubjects} className="grid">
            <Field label="Subjects (used for subject-wise exam papers)">
              <SubjectsInput subjects={editSubjects} setSubjects={setEditSubjects} autoFocus />
            </Field>
            <button>Save subjects</button>
          </form>
        </Modal>
      )}

      {sectionFor && (
        <Modal error={error} title={`Add section to ${sectionFor.name}`} onClose={() => setSectionFor(null)}>
          <form onSubmit={addSection} className="grid">
            <Field label="Section name">
              <input value={sectionName} onChange={(e) => setSectionName(e.target.value)}
                placeholder="e.g. A" required autoFocus />
            </Field>
            <button>Add section</button>
          </form>
        </Modal>
      )}
    </>
  )
}
