import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MANAGERS, api } from '../api.js'
import { Field, Modal } from '../components/ui.jsx'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

/**
 * Weekly timetable grid.
 * - Managers open it per teacher (/teachers/:teacherId/timetable) and can
 *   add/edit/delete slots ("Monday 2nd period → Class 2-B, Maths").
 * - Teachers see their own read-only version at /my-timetable.
 */
export default function TeacherTimetable({ user, mine = false }) {
  const { teacherId } = useParams()
  const canEdit = !mine && MANAGERS.includes(user.user_type)
  const [slots, setSlots] = useState(null)
  const [teacherName, setTeacherName] = useState(mine ? user.full_name : '')
  const [classes, setClasses] = useState([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // {day, period, slot?}
  const [form, setForm] = useState({ class_id: '', section_id: '', subject: '' })

  async function load() {
    try {
      setSlots(await api(mine ? '/timetable/mine' : `/timetable?teacher_id=${teacherId}`))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
    if (canEdit) {
      api('/classes').then(setClasses).catch(() => {})
      api('/users/teachers')
        .then((ts) => {
          const t = ts.find((x) => x.id === Number(teacherId))
          if (t) setTeacherName(t.full_name)
        })
        .catch(() => {})
    }
  }, [teacherId, mine])

  const byCell = {}
  for (const s of slots || []) byCell[`${s.day}-${s.period}`] = s

  function openCell(day, period) {
    if (!canEdit) return
    const slot = byCell[`${day}-${period}`]
    setForm(
      slot
        ? { class_id: String(slot.class_id), section_id: String(slot.section_id), subject: slot.subject || '' }
        : { class_id: '', section_id: '', subject: '' },
    )
    setEditing({ day, period, slot })
  }

  async function save(e) {
    e.preventDefault()
    try {
      await api('/timetable', {
        method: 'PUT',
        body: {
          teacher_id: Number(teacherId),
          day: editing.day,
          period: editing.period,
          class_id: Number(form.class_id),
          section_id: Number(form.section_id),
          subject: form.subject || null,
        },
      })
      setEditing(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeSlot() {
    try {
      await api(`/timetable/${editing.slot.id}`, { method: 'DELETE' })
      setEditing(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const selClass = classes.find((c) => c.id === Number(form.class_id))

  return (
    <>
      {!mine && (
        <div className="bc">
          <Link to="/users">Users</Link> › <span>{teacherName || 'Teacher'}</span> › <span>Timetable</span>
        </div>
      )}
      <div className="page-head" style={{ marginTop: mine ? 0 : 8 }}>
        <h2>{mine ? 'My timetable' : `Timetable — ${teacherName}`}</h2>
        <p>
          {canEdit
            ? 'Click any cell to assign a class, section and subject to that period.'
            : 'Your weekly class schedule.'}
        </p>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        {!slots ? (
          <div className="skeleton">Loading…</div>
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Period</th>
                  {DAYS.map((d) => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((p) => (
                  <tr key={p}>
                    <td style={{ fontWeight: 700 }}>{p}</td>
                    {DAYS.map((_, day) => {
                      const slot = byCell[`${day}-${p}`]
                      return (
                        <td
                          key={day}
                          onClick={() => openCell(day, p)}
                          style={{
                            cursor: canEdit ? 'pointer' : 'default',
                            background: slot ? 'var(--brand-soft)' : undefined,
                            borderRadius: 8,
                          }}
                          title={canEdit ? 'Click to edit' : undefined}
                        >
                          {slot ? (
                            <>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>
                                {slot.class_name} — {slot.section_name}
                              </div>
                              {slot.subject && (
                                <div className="small muted">{slot.subject}</div>
                              )}
                            </>
                          ) : (
                            <span className="muted small">{canEdit ? '+ ' : ''}—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal error={error}
          title={`${DAYS[editing.day]} · Period ${editing.period} — ${teacherName}`}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save} className="grid">
            <div className="grid cols-2">
              <Field label="Class">
                <select value={form.class_id} required
                  onChange={(e) => setForm({ ...form, class_id: e.target.value, section_id: '' })}>
                  <option value="">Select…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Section">
                <select value={form.section_id} required disabled={!selClass}
                  onChange={(e) => setForm({ ...form, section_id: e.target.value })}>
                  <option value="">Select…</option>
                  {(selClass?.sections || []).map((s) => (
                    <option key={s.id} value={s.id}>Section {s.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Subject (optional)">
              <input value={form.subject} placeholder="e.g. Mathematics" list="tt-subjects"
                onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              <datalist id="tt-subjects">
                {(selClass?.subjects || []).map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>
            <div className="row" style={{ gap: 8 }}>
              <button style={{ flex: 1 }}>{editing.slot ? 'Save changes' : 'Assign period'}</button>
              {editing.slot && (
                <button type="button" className="danger" style={{ flex: 1 }} onClick={removeSlot}>
                  Clear period
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
