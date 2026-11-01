import React, { useEffect, useMemo, useState } from 'react'
import { MANAGERS, api, fmtDateTime } from '../api.js'
import { ErrorBox, Field, TimeInput } from '../components/ui.jsx'
import { isMissingEndpoint } from '../hooks/useApi.js'
import { timeRange } from '../lib/format.js'
import { EMPTY_TIMINGS, MAX_PERIODS_PER_DAY, buildSchedule, timingsError } from '../lib/schedule.js'

const toForm = (tm) => ({
  start_time: (tm.start_time || '').slice(0, 5),
  prayer_minutes: String(tm.prayer_minutes ?? 0),
  period_minutes: String(tm.period_minutes ?? 40),
  periods_per_day: String(tm.periods_per_day ?? 8),
  breaks: (tm.breaks || []).map((b) => ({ after_period: String(b.after_period), minutes: String(b.minutes), label: b.label || '' })),
})

const toTimings = (f) => ({
  start_time: f.start_time,
  prayer_minutes: Number(f.prayer_minutes || 0),
  period_minutes: Number(f.period_minutes || 0),
  periods_per_day: Number(f.periods_per_day || 0),
  breaks: f.breaks
    .map((b) => ({ after_period: Number(b.after_period || 0), minutes: Number(b.minutes || 0), label: b.label.trim() || null }))
    .sort((a, b) => a.after_period - b.after_period),
})

/**
 * School timings (coordinator / principal / admin): start time, prayer,
 * period length, periods per day and breaks. All timetables take their
 * clock times from here — change it for summer / winter timings.
 */
export default function SchoolTimings({ user }) {
  const canEdit = MANAGERS.includes(user.user_type)
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/settings/school-timings')
      .then((tm) => {
        setSaved(tm?.start_time ? tm : null)
        setForm(toForm(tm?.start_time ? tm : EMPTY_TIMINGS))
      })
      .catch((e) => {
        if (isMissingEndpoint(e)) setMissing(true)
        else setError(e.message)
        setForm(toForm(EMPTY_TIMINGS))
      })
  }, [])

  const timings = useMemo(() => (form ? toTimings(form) : null), [form])
  const schedule = useMemo(() => (timings ? buildSchedule(timings) : []), [timings])

  if (!form) return <div className="skeleton">Loading…</div>

  const set = (patch) => { setDone(''); setForm((f) => ({ ...f, ...patch })) }
  const setBreak = (i, patch) => set({ breaks: form.breaks.map((b, j) => (j === i ? { ...b, ...patch } : b)) })
  const num = (v, max = 3) => v.replace(/[^0-9]/g, '').slice(0, max)
  const periods = Number(form.periods_per_day) || 0

  async function save(e) {
    e.preventDefault()
    const bad = timingsError(timings)
    if (bad) return setError(bad)
    setBusy(true)
    setError('')
    try {
      const res = await api('/settings/school-timings', { method: 'PUT', body: timings })
      setSaved(res?.start_time ? res : timings)
      setDone('Saved. Every timetable now uses these timings.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>School timings</h2>
        <p>Set when the school day starts, prayer time, period length and breaks. Change it for summer and winter timings — timetables follow automatically.</p>
      </div>
      {missing && <div className="notice warn mb-3.5">Saving school timings needs the latest server update. You can preview the schedule below.</div>}
      <ErrorBox error={error} />
      {done && <div className="notice ok mb-3.5">{done}</div>}

      <div className="grid cols-2 items-start">
        <form className="card mb-0" onSubmit={save}>
          <h3>School day</h3>
          <fieldset disabled={!canEdit} className="grid">
            <div className="grid cols-2">
              <Field label="School starts at *">
                <TimeInput value={form.start_time} required onChange={(e) => set({ start_time: e.target.value })} />
              </Field>
              <Field label="Prayer / assembly (minutes)">
                <input inputMode="numeric" value={form.prayer_minutes} onChange={(e) => set({ prayer_minutes: num(e.target.value) })} />
              </Field>
              <Field label="Period length (minutes)">
                <input inputMode="numeric" value={form.period_minutes} onChange={(e) => set({ period_minutes: num(e.target.value) })} />
              </Field>
              <Field label={`Periods per day (max ${MAX_PERIODS_PER_DAY})`}>
                <input inputMode="numeric" value={form.periods_per_day} onChange={(e) => set({ periods_per_day: num(e.target.value, 2) })} />
              </Field>
            </div>
            <p className="muted small -mt-1">Prayer happens before period 1 — e.g. start 6:30 AM + 30 min prayer → period 1 at 7:00 AM.</p>

            <div className="split mt-2">
              <h4 className="font-bold">Breaks</h4>
              <button type="button" className="soft sm"
                onClick={() => set({ breaks: [...form.breaks, { after_period: String(Math.min(3, Math.max(1, periods - 1))), minutes: '20', label: '' }] })}>
                + Add break
              </button>
            </div>
            {form.breaks.length === 0 && <p className="muted small">No breaks yet — e.g. add a 20-minute break after period 3.</p>}
            {form.breaks.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr_auto] items-end gap-2">
                <Field label="After period">
                  <input inputMode="numeric" value={b.after_period} onChange={(e) => setBreak(i, { after_period: num(e.target.value, 2) })} />
                </Field>
                <Field label="Minutes">
                  <input inputMode="numeric" value={b.minutes} onChange={(e) => setBreak(i, { minutes: num(e.target.value) })} />
                </Field>
                <Field label="Name">
                  <input value={b.label} placeholder="Break" onChange={(e) => setBreak(i, { label: e.target.value })} />
                </Field>
                <button type="button" className="danger mb-px h-[40px]" aria-label="Remove break"
                  onClick={() => set({ breaks: form.breaks.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
          </fieldset>
          {canEdit && <button className="mt-4 w-full" disabled={busy}>{busy ? 'Saving…' : 'Save school timings'}</button>}
          {saved?.updated_at && (
            <p className="muted small mt-2 text-center">
              Last changed {fmtDateTime(saved.updated_at)}{saved.updated_by_name ? ` · ${saved.updated_by_name}` : ''}
            </p>
          )}
        </form>

        <div className="card mb-0">
          <h3>Bell schedule</h3>
          {schedule.length === 0 ? (
            <p className="muted">Pick the start time to see the schedule.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line">
              {schedule.map((r, i) => (
                <div key={i} className={`sched-row ${r.kind !== 'period' ? 'marker' : ''}`}>
                  <b className={r.kind !== 'period' ? 'font-semibold' : ''}>
                    {r.kind === 'prayer' ? '🙏 Prayer / assembly' : r.kind === 'break' ? `☕ ${r.label}` : `Period ${r.period}`}
                  </b>
                  <span className="muted small font-semibold">{timeRange(r.start, r.end)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
