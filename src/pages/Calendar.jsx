import React, { useEffect, useMemo, useState } from 'react'
import { api, fmtDate } from '../api.js'
import { Field, Modal } from '../components/ui.jsx'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const EDITORS = ['admin', 'principal', 'sub_admin']

/** category → color: holidays/Sundays yellow, exams blue, other events green */
const CATEGORIES = [
  { value: 'holiday', label: 'Holiday', badge: 'amber' },
  { value: 'exam', label: 'Exam', badge: 'blue' },
  { value: 'event', label: 'Event', badge: 'green' },
]
const badgeOf = (cat) => CATEGORIES.find((c) => c.value === cat)?.badge || 'gray'
const CELL_TONES = {
  holiday: 'bg-warn-soft text-warn',
  exam: 'bg-info-soft text-info',
  event: 'bg-ok-soft text-ok',
}

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Inclusive "YYYY-MM-DD" range → list of ISO dates. */
function eachDate(start, end) {
  const out = []
  const d = new Date(`${start}T00:00:00`)
  const stop = new Date(`${end}T00:00:00`)
  while (d <= stop && out.length < 370) {
    out.push(iso(d.getFullYear(), d.getMonth(), d.getDate()))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export default function Calendar({ user }) {
  const canEdit = EDITORS.includes(user.user_type)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-11
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | {eventId: number|null}

  const load = () => api('/calendar').then(setData).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  /** iso date → {holiday: [names], exam: [names], event: [names]} */
  const dayInfo = useMemo(() => {
    const map = {}
    const add = (date, kind, name) => {
      const slot = (map[date] ||= { holiday: [], exam: [], event: [] })
      slot[kind].push(name)
    }
    if (data) {
      data.holidays.forEach((h) => add(h.date, 'holiday', h.name))
      data.events.forEach((e) => e.dates.forEach((d) => add(d, e.category, e.title)))
      data.exams.forEach((x) =>
        eachDate(x.start_date, x.end_date).forEach((d) =>
          add(d, 'exam', x.class_name ? `${x.name} (Class ${x.class_name})` : x.name)))
    }
    return map
  }, [data])

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) } else setMonth(month - 1)
  }
  const next = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) } else setMonth(month + 1)
  }

  const offset = (new Date(year, month, 1).getDay() + 6) % 7 // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate())
  const inMonth = (d) => d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)

  /** Sundays and holiday dates win over exams (exam on Sunday = holiday). */
  function cellTone(date, isSunday) {
    const info = dayInfo[date]
    if (isSunday || info?.holiday.length) return 'holiday'
    if (info?.exam.length) return 'exam'
    if (info?.event.length) return 'event'
    return null
  }

  const monthEvents = (data?.events || []).filter((e) => e.dates.some(inMonth))
  const monthExams = (data?.exams || []).filter((x) =>
    eachDate(x.start_date, x.end_date).some(inMonth))

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Calendar</h2>
          <p>{canEdit ? 'Mark holidays, exams and events for the whole school.'
            : 'School holidays, exams and events.'}</p>
        </div>
        <div className="row center fit" style={{ gap: 8 }}>
          <button className="ghost fit" onClick={prev} aria-label="Previous month">‹</button>
          <strong className="fit" style={{ minWidth: 130, textAlign: 'center' }}>
            {MONTHS[month]} {year}
          </strong>
          <button className="ghost fit" onClick={next} aria-label="Next month">›</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEK.map((w) => (
            <div key={w} className="py-1 text-center text-[12px] font-bold text-subtle">{w}</div>
          ))}
          {Array.from({ length: offset }).map((_, i) => <div key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = iso(year, month, i + 1)
            const isSunday = new Date(year, month, i + 1).getDay() === 0
            const tone = cellTone(date, isSunday)
            const info = dayInfo[date]
            const names = info ? [...info.holiday, ...info.exam, ...info.event] : []
            return (
              <div
                key={date}
                title={names.join(', ') || (isSunday ? 'Sunday' : '')}
                className={`min-h-[54px] rounded-[10px] p-1.5 text-center md:min-h-[64px] ${
                  tone ? CELL_TONES[tone] : 'bg-page text-ink'
                } ${date === todayIso ? 'ring-2 ring-brand' : ''}`}
              >
                <div className="text-[13px] font-bold">{i + 1}</div>
                {names[0] && (
                  <div className="mt-0.5 truncate text-[10.5px] font-semibold">{names[0]}</div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-line pt-3.5">
          <span className="badge amber">Holiday / Sunday</span>
          <span className="badge blue">Exam</span>
          <span className="badge green">Event</span>
          <div style={{ flex: 1 }} />
          {canEdit && (
            <button className="fit" onClick={() => setEditing({ eventId: null })}>+ Add event</button>
          )}
        </div>
      </div>

      {(monthEvents.length > 0 || monthExams.length > 0) && (
        <div className="card">
          <h3>This month</h3>
          {monthEvents.map((e) => (
            <div className="list-item row center" key={e.id}>
              <span className={`badge fit ${badgeOf(e.category)}`}>{e.category}</span>
              <strong>{e.title}</strong>
              <span className="muted small fit">
                {e.dates.filter(inMonth).map((d) => fmtDate(d)).join(', ')}
              </span>
              {canEdit && (
                <button className="ghost fit" onClick={() => setEditing({ eventId: e.id })}>Edit</button>
              )}
            </div>
          ))}
          {monthExams.map((x) => (
            <div className="list-item row center" key={`x${x.id}`}>
              <span className="badge fit blue">exam</span>
              <strong>{x.class_name ? `${x.name} (Class ${x.class_name})` : x.name}</strong>
              <span className="muted small fit">
                {fmtDate(x.start_date)} – {fmtDate(x.end_date)} · from Exams tab
              </span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EventModal
          events={data?.events || []}
          eventId={editing.eventId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </>
  )
}

/** Popup: pick an existing event (or create one), then mark/edit its dates. */
function EventModal({ events, eventId, onClose, onSaved }) {
  const [sel, setSel] = useState(eventId ?? '') // '' | 'new' | event id
  const [form, setForm] = useState({ title: '', category: 'event' })
  const [dates, setDates] = useState([])
  const [dateInput, setDateInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (sel === '' || sel === 'new') {
      setForm({ title: '', category: 'event' })
      setDates([])
      return
    }
    const e = events.find((x) => x.id === sel)
    if (e) {
      setForm({ title: e.title, category: e.category })
      setDates([...e.dates])
    }
  }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  const addDate = () => {
    if (dateInput && !dates.includes(dateInput)) setDates([...dates, dateInput].sort())
    setDateInput('')
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      let id = sel
      if (sel === 'new') id = (await api('/calendar/events', { method: 'POST', body: form })).id
      await api(`/calendar/events/${id}`, { method: 'PUT', body: { ...form, dates } })
      onSaved()
    } catch (error) {
      setErr(error.message)
      setBusy(false)
    }
  }

  async function removeEvent() {
    if (!confirm(`Delete "${form.title}" and all its marked dates?`)) return
    setBusy(true)
    try {
      await api(`/calendar/events/${sel}`, { method: 'DELETE' })
      onSaved()
    } catch (error) {
      setErr(error.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={sel === 'new' ? 'New event' : 'Add event'} onClose={onClose}>
      {err && <div className="error">{err}</div>}
      <form onSubmit={save} className="grid">
        <Field label="Event">
          <div className="flex flex-wrap gap-1.5">
            {events.map((e) => (
              <button
                type="button"
                key={e.id}
                onClick={() => setSel(e.id)}
                className={`fit ${sel === e.id ? '' : 'ghost border border-line'}`}
              >
                {e.title}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSel('new')}
              className={`fit ${sel === 'new' ? '' : 'ghost border border-line'}`}
            >
              ＋ New event
            </button>
          </div>
        </Field>

        {sel !== '' && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name">
                <input value={form.title} required maxLength={150}
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Category">
                <select value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Dates">
              <div className="row center" style={{ gap: 8 }}>
                <input type="date" value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)} />
                <button type="button" className="soft fit" onClick={addDate}>Add</button>
              </div>
              {dates.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {dates.map((d) => (
                    <span key={d} className="chip">
                      {fmtDate(d)}
                      <button type="button" className="icon" style={{ padding: '0 2px' }}
                        onClick={() => setDates(dates.filter((x) => x !== d))} aria-label={`Remove ${d}`}>
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>

            <div className="row center" style={{ gap: 8 }}>
              <button disabled={busy} style={{ flex: 1 }}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              {sel !== 'new' && (
                <button type="button" className="danger fit" disabled={busy} onClick={removeEvent}>
                  Delete event
                </button>
              )}
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}
