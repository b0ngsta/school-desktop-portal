import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MANAGERS, api, fmtDate } from '../api.js'
import { Field, Modal } from '../components/ui.jsx'
import { isMissingEndpoint, useSchoolTimings } from '../hooks/useApi.js'
import { addDays, timeRange, weekStart } from '../lib/format.js'
import { buildSchedule, periodCount } from '../lib/schedule.js'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Rows of the grid: prayer / periods / breaks (just periods when timings are unknown). */
function useRows(timings) {
  return useMemo(() => (timings
    ? buildSchedule(timings)
    : Array.from({ length: periodCount(null) }, (_, i) => ({ kind: 'period', period: i + 1 }))), [timings])
}

/**
 * Weekly timetable grid.
 * - Managers open it per teacher (/teachers/:teacherId/timetable) and can
 *   add/edit/delete slots ("Monday 2nd period → Class 2-B, Maths").
 * - Teachers see their own at /my-timetable as a dated week: substitutions
 *   they cover, periods others cover for them, leave days and holidays.
 * Clock times come from Settings → School timings.
 */
export default function TeacherTimetable({ user, mine = false }) {
  const { teacherId } = useParams()
  const canEdit = !mine && MANAGERS.includes(user.user_type)
  const timings = useSchoolTimings()
  const rows = useRows(timings)
  const [slots, setSlots] = useState(null)
  const [week, setWeek] = useState(null) // mine: /timetable/week payload
  const [start, setStart] = useState(weekStart)
  const [weekly, setWeekly] = useState(false) // mine, but the server has no /timetable/week
  const [teacherName, setTeacherName] = useState(mine ? user.full_name : '')
  const [classes, setClasses] = useState([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // {day, period, slot?}
  const [form, setForm] = useState({ class_id: '', section_id: '', subject: '' })

  async function load() {
    try {
      if (mine && !weekly) {
        try {
          const w = await api(`/timetable/week?start=${start}`)
          setWeek(w)
          setSlots(w.slots || [])
          return
        } catch (e) {
          if (!isMissingEndpoint(e)) throw e
          setWeekly(true)
        }
      }
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
  }, [teacherId, mine, start])

  const byCell = {}
  for (const s of slots || []) byCell[`${s.day}-${s.period}`] = s
  const subs = {}
  for (const s of week?.substitutions || []) {
    if (['pending', 'accepted'].includes(s.status)) subs[`${s.day}-${s.period}`] = s
  }
  const dayInfo = (day) => week?.days?.find((d) => d.day === day)

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
  const dated = mine && !!week
  const thisWeek = weekStart()

  return (
    <>
      {!mine && (
        <div className="bc">
          <Link to="/users">Users</Link> › <span>{teacherName || 'Teacher'}</span> › <span>Timetable</span>
        </div>
      )}
      <div className="page-head split" style={{ marginTop: mine ? 0 : 8 }}>
        <div>
          <h2>{mine ? 'My timetable' : `Timetable — ${teacherName}`}</h2>
          <p>
            {canEdit
              ? 'Click any cell to assign a class, section and subject to that period.'
              : dated ? 'Your week, including substitutions.' : 'Your weekly class schedule.'}
            {!timings && ' Set clock times in Settings → School timings.'}
          </p>
        </div>
        {dated && (
          <div className="row-right">
            <button className="ghost" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">←</button>
            <button className="ghost" disabled={start === thisWeek} onClick={() => setStart(thisWeek)}>This week</button>
            <button className="ghost" onClick={() => setStart(addDays(start, 7))} aria-label="Next week">→</button>
          </div>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {dated && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
          <b>{fmtDate(start)} – {fmtDate(addDays(start, 5))}</b>
          <span className="badge amber">Substitution you cover</span>
          <span className="badge green">Covered by a colleague</span>
        </div>
      )}

      <div className="card">
        {!slots ? (
          <div className="skeleton">Loading…</div>
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Period</th>
                  {DAYS.map((d, day) => {
                    const info = dayInfo(day)
                    return (
                      <th key={d}>
                        {d}
                        {info && <div className="font-medium normal-case tracking-normal">{fmtDate(info.date)}</div>}
                        {info?.holiday && <div className="badge amber mt-1 normal-case tracking-normal">🏖️ {info.holiday}</div>}
                        {info?.on_leave && !info.holiday && <div className="badge gray mt-1 normal-case tracking-normal">🧳 On leave</div>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  if (r.kind !== 'period') {
                    return (
                      <tr key={`${r.kind}-${r.afterPeriod || 0}`} className="bg-page">
                        <td colSpan={DAYS.length + 1} className="py-1.5 text-center text-[12px] font-semibold text-subtle">
                          {r.kind === 'prayer' ? '🙏 Prayer / assembly' : `☕ ${r.label}`} · {timeRange(r.start, r.end)}
                        </td>
                      </tr>
                    )
                  }
                  const p = r.period
                  return (
                    <tr key={p}>
                      <td>
                        <b>{p}</b>
                        {r.start && <div className="muted whitespace-nowrap text-[11.5px]">{timeRange(r.start, r.end)}</div>}
                      </td>
                      {DAYS.map((_, day) => {
                        const slot = byCell[`${day}-${p}`]
                        const sub = subs[`${day}-${p}`]
                        const covering = sub?.kind === 'covering'
                        const off = !!dayInfo(day)?.holiday
                        return (
                          <td
                            key={day}
                            onClick={() => openCell(day, p)}
                            style={{
                              cursor: canEdit ? 'pointer' : 'default',
                              background: covering ? 'var(--warn-soft)' : slot ? 'var(--brand-soft)' : undefined,
                              borderRadius: 8,
                              opacity: off ? 0.45 : 1,
                            }}
                            title={canEdit ? 'Click to edit' : undefined}
                          >
                            {covering ? (
                              <>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>
                                  {sub.class_name ? `${sub.class_name} — ${sub.section_name}` : 'Substitution'}
                                </div>
                                <div className="small text-warn">🔁 For {sub.other_teacher_name}</div>
                              </>
                            ) : slot ? (
                              <>
                                <div style={{ fontWeight: 700, fontSize: 13 }}
                                  className={sub?.status === 'accepted' ? 'text-subtle line-through' : ''}>
                                  {slot.class_name} — {slot.section_name}
                                </div>
                                {slot.subject && <div className="small muted">{slot.subject}</div>}
                                {sub && (
                                  <div className={`small ${sub.status === 'accepted' ? 'text-ok' : 'text-warn'}`}>
                                    {sub.status === 'accepted' ? `✓ ${sub.other_teacher_name}` : `⏳ ${sub.other_teacher_name}?`}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="muted small">{canEdit ? '+ ' : ''}—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
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
