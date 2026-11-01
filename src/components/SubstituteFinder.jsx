import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { isMissingEndpoint } from '../hooks/useApi.js'
import { fmtDayLong, fmtDayShort, timeRange } from '../lib/format.js'
import { Avatar, ErrorBox, Spinner } from './ui.jsx'

const ACTIVE = ['pending', 'accepted']
const ISO = /^\d{4}-\d{2}-\d{2}$/

export const pickKey = (date, period) => `${date}|${period}`

/** Ticked teachers → [{date, period, substitute_id}] for the leave body (only dates inside the leave). */
export function picksToBody(picks, from, to) {
  const out = []
  for (const [key, ids] of Object.entries(picks)) {
    const [date, period] = key.split('|')
    if (date < from || date > to) continue
    for (const id of ids) out.push({ date, period: Number(period), substitute_id: id })
  }
  return out
}

/**
 * Date tabs → the periods the teacher teaches that day → colleagues who are
 * free then. A ticked teacher is requested when the leave is saved; "Request"
 * sends that one request right away (onSent gets its id).
 */
export default function SubstituteFinder({ from, to, leaveId, picks, onPicks, onSent }) {
  const valid = ISO.test(from || '') && ISO.test(to || '') && from <= to
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [day, setDay] = useState(null)
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    if (!valid) return
    setLoading(true)
    setError('')
    try {
      const res = await api(`/substitutions/availability?from=${from}&to=${to}${leaveId ? `&leave_id=${leaveId}` : ''}`)
      setData(res)
      setMissing(false)
      setDay((d) => (d && res.days.some((x) => x.date === d) ? d
        : res.days.find((x) => x.periods.length)?.date ?? res.days[0]?.date ?? null))
    } catch (e) {
      if (isMissingEndpoint(e)) setMissing(true)
      else setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [valid, from, to, leaveId])
  useEffect(() => { load() }, [load])

  const current = useMemo(() => data?.days.find((d) => d.date === day) || null, [data, day])

  function toggle(date, period, teacherId) {
    const key = pickKey(date, period)
    const ids = picks[key] || []
    const next = ids.includes(teacherId) ? ids.filter((x) => x !== teacherId) : [...ids, teacherId]
    const copy = { ...picks }
    if (next.length) copy[key] = next
    else delete copy[key]
    onPicks(copy)
  }

  async function requestNow(date, period, teacherId) {
    setBusy(`${date}|${period}|${teacherId}`)
    setError('')
    try {
      const r = await api('/substitutions', {
        method: 'POST',
        body: { date, period, substitute_id: teacherId, leave_id: leaveId || null },
      })
      // no longer needs to be sent on submit
      const key = pickKey(date, period)
      if (picks[key]?.includes(teacherId)) {
        const copy = { ...picks, [key]: picks[key].filter((x) => x !== teacherId) }
        if (!copy[key].length) delete copy[key]
        onPicks(copy)
      }
      if (r?.id) onSent?.(r.id)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function cancel(r) {
    if (!confirm(`Cancel the request to ${r.substitute_name}?`)) return
    setBusy(`r${r.id}`)
    try {
      await api(`/substitutions/${r.id}/cancel`, { method: 'PUT' })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (!valid) return <p className="muted small mb-3.5">Pick the leave dates to see your classes and the teachers who are free.</p>
  if (missing) return <div className="notice warn mb-3.5">The substitute finder needs the latest server update.</div>
  if (loading && !data) return <div className="skeleton"><Spinner /> Finding free teachers…</div>
  if (!data) return <ErrorBox error={error} />
  if (data.days.length === 0) return <p className="muted small mb-3.5">No school days in these dates.</p>

  return (
    <div className="mb-3.5">
      <ErrorBox error={error} />
      <div className="day-tabs">
        {data.days.map((d) => (
          <button type="button" key={d.date} className={`day-tab ${d.date === day ? 'active' : ''}`}
            onClick={() => { setDay(d.date); setOpen(null) }}>
            {fmtDayShort(d.date)}
            <span className="sub">
              {d.holiday ? 'Holiday' : `${d.periods.length} class${d.periods.length === 1 ? '' : 'es'}`}
            </span>
          </button>
        ))}
      </div>

      {current && (
        <>
          <h4 className="mb-2.5 text-[15px] font-extrabold">{fmtDayLong(current.date)}</h4>
          {current.holiday ? (
            <div className="notice">🏖️ {current.holiday} — nothing to cover.</div>
          ) : current.periods.length === 0 ? (
            <p className="muted small">You have no classes this day.</p>
          ) : (
            <div className="period-list">
              <div className="hidden grid-cols-[70px_160px_1fr_auto] gap-2 border-b border-line bg-page px-3.5 py-2
                text-[11.5px] font-semibold uppercase tracking-wider text-subtle md:grid">
                <span>Period</span><span>Time</span><span>Available substitute teachers</span><span>Action</span>
              </div>
              {current.periods.map((p) => (
                <PeriodRow key={p.period} date={current.date} p={p}
                  open={open === p.period} onToggle={() => setOpen((o) => (o === p.period ? null : p.period))}
                  picked={picks[pickKey(current.date, p.period)] || []}
                  onPick={(id) => toggle(current.date, p.period, id)}
                  onRequest={(id) => requestNow(current.date, p.period, id)}
                  onCancel={cancel} busy={busy} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PeriodRow({ date, p, open, onToggle, picked, onPick, onRequest, onCancel, busy }) {
  const active = p.requests.filter((r) => ACTIVE.includes(r.status))
  const accepted = active.find((r) => r.status === 'accepted')
  const requested = new Set(active.map((r) => r.substitute_id))
  const count = p.available.length
  const canOpen = count > 0 || active.length > 0
  const time = timeRange(p.start_time, p.end_time)

  return (
    <div className={`period-row ${open ? 'open' : ''}`}>
      <button type="button" className="period-head" onClick={onToggle} disabled={!canOpen} aria-expanded={open}>
        <div className="md:contents">
          <span className="font-bold">
            <span className="md:hidden">Period </span>{p.period}
          </span>
          <span className="muted small ml-2 md:ml-0 md:text-[13.5px] md:text-ink">{time || '—'}</span>
          <span className="mt-1 block md:mt-0">
            <span className="muted small mr-2 md:hidden">
              {p.slot.class_name} — {p.slot.section_name}{p.slot.subject ? ` · ${p.slot.subject}` : ''}
            </span>
            {accepted ? (
              <span className="badge green">✓ Covered by {accepted.substitute_name}</span>
            ) : active.length || picked.length ? (
              <span className="badge amber">{active.length + picked.length} requested</span>
            ) : count === 0 ? (
              <span className="inline-flex flex-col">
                <span className="badge gray w-fit">No substitutes available</span>
                <span className="muted mt-0.5 text-[11px]">All teachers busy</span>
              </span>
            ) : (
              <span className="badge green">{count} available</span>
            )}
            <span className="muted small ml-2 hidden md:inline">
              {p.slot.class_name} — {p.slot.section_name}{p.slot.subject ? ` · ${p.slot.subject}` : ''}
            </span>
          </span>
        </div>
        <span className="text-brand">{canOpen ? (open ? '▴' : '▾') : '—'}</span>
      </button>

      {open && (
        <div className="teacher-table">
          <div className="hidden grid-cols-[auto_1.4fr_1fr_auto_auto] gap-3 border-b border-line bg-page px-3 py-2
            text-[11.5px] font-semibold uppercase tracking-wider text-subtle md:grid">
            <span className="w-[18px]" /><span>Teacher</span><span>Subject</span><span>Availability</span>
            <span className="w-[92px] text-center">Action</span>
          </div>
          {active.map((r) => (
            <div key={`r${r.id}`} className="teacher-row">
              <span className="w-[18px] text-center">{r.status === 'accepted' ? '✅' : '⏳'}</span>
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={r.substitute_name} photo={r.substitute_photo} size={30} />
                <b className="truncate">{r.substitute_name}</b>
              </div>
              <span className="muted small hidden md:block">{r.status === 'accepted' ? 'Accepted' : 'Waiting for reply'}</span>
              <span className={`badge ${r.status === 'accepted' ? 'green' : 'amber'} hidden md:inline-flex`}>{r.status}</span>
              <button type="button" className="danger sm w-[92px]" disabled={busy === `r${r.id}`} onClick={() => onCancel(r)}>
                Cancel
              </button>
            </div>
          ))}
          {!accepted && p.available.filter((a) => !requested.has(a.teacher_id)).map((a) => {
            const on = picked.includes(a.teacher_id)
            const sending = busy === `${date}|${p.period}|${a.teacher_id}`
            return (
              <div key={a.teacher_id} className="teacher-row">
                <input type="checkbox" checked={on} onChange={() => onPick(a.teacher_id)}
                  aria-label={`Request ${a.full_name} when I submit`} />
                <label className="m-0 flex min-w-0 cursor-pointer items-center gap-2.5 text-[13.5px] font-semibold text-ink"
                  onClick={() => onPick(a.teacher_id)}>
                  <Avatar name={a.full_name} photo={a.photo_path} size={30} />
                  <span className="truncate">{a.full_name}</span>
                </label>
                <span className="muted small hidden md:block">{a.subject || '—'}</span>
                <span className="badge green hidden md:inline-flex">Free</span>
                <button type="button" className="ghost sm w-[92px] !border-danger/40 !text-danger"
                  disabled={sending} onClick={() => onRequest(a.teacher_id)}>
                  {sending ? '…' : 'Request'}
                </button>
              </div>
            )
          })}
          {!accepted && count === 0 && (
            <div className="muted small px-3 py-2.5">No other teacher is free this period.</div>
          )}
        </div>
      )}
    </div>
  )
}
