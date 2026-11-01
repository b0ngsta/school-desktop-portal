/**
 * School day maths: start time + prayer + periods + breaks → clock times.
 *   start 06:30, prayer 30 min, 45-min periods, 20-min break after period 3
 *   → prayer 06:30–07:00, P1 07:00–07:45 … P3 08:30–09:15, break 09:15–09:35, P4 09:35–10:20
 * Same rules as the mobile app (src/schedule.ts). When the server sends the
 * computed `periods`, those win.
 */
import { clockHm, parseClock } from './format.js'

export const DEFAULT_PERIODS_PER_DAY = 8
export const MAX_PERIODS_PER_DAY = 12

export const EMPTY_TIMINGS = {
  start_time: '08:00',
  prayer_minutes: 15,
  period_minutes: 40,
  periods_per_day: DEFAULT_PERIODS_PER_DAY,
  breaks: [],
}

const whole = (n, min, max) => Number.isInteger(n) && n >= min && n <= max

/** First problem with a timings object, or '' when it can be saved. */
export function timingsError(tm) {
  if (parseClock(tm.start_time) == null) return 'Pick the school start time.'
  if (!whole(tm.prayer_minutes, 0, 120)) return 'Prayer time must be 0–120 minutes.'
  if (!whole(tm.period_minutes, 10, 180)) return 'Period length must be 10–180 minutes.'
  if (!whole(tm.periods_per_day, 1, MAX_PERIODS_PER_DAY)) return `Periods per day must be 1–${MAX_PERIODS_PER_DAY}.`
  const seen = new Set()
  for (const b of tm.breaks || []) {
    if (!whole(b.after_period, 1, tm.periods_per_day - 1)) {
      return `A break must come after period 1–${Math.max(1, tm.periods_per_day - 1)}.`
    }
    if (!whole(b.minutes, 1, 180)) return 'Break length must be 1–180 minutes.'
    if (seen.has(b.after_period)) return `Only one break after period ${b.after_period}.`
    seen.add(b.after_period)
  }
  const total = tm.prayer_minutes + tm.period_minutes * tm.periods_per_day +
    (tm.breaks || []).reduce((a, b) => a + b.minutes, 0)
  if (parseClock(tm.start_time) + total > 24 * 60) return 'The school day runs past midnight.'
  return ''
}

/** [{kind:'prayer'|'period'|'break', period?, afterPeriod?, label?, start, end}] */
export function buildSchedule(tm) {
  let at = parseClock(tm?.start_time)
  if (at == null) return []
  const rows = []
  const prayer = Math.max(0, Number(tm.prayer_minutes) || 0)
  if (prayer > 0) {
    rows.push({ kind: 'prayer', start: clockHm(at), end: clockHm(at + prayer) })
    at += prayer
  }
  const breaks = new Map((tm.breaks || []).map((b) => [Number(b.after_period), b]))
  const len = Math.max(1, Number(tm.period_minutes) || 0)
  const count = periodCount(tm)
  const server = new Map((tm.periods || []).map((p) => [p.period, p]))
  for (let p = 1; p <= count; p++) {
    const fixed = server.get(p)
    const start = fixed?.start?.slice(0, 5) || clockHm(at)
    const end = fixed?.end?.slice(0, 5) || clockHm(at + len)
    rows.push({ kind: 'period', period: p, start, end })
    at = parseClock(end) ?? at + len
    const b = breaks.get(p)
    if (b && p < count) {
      const mins = Math.max(0, Number(b.minutes) || 0)
      rows.push({ kind: 'break', afterPeriod: p, label: b.label?.trim() || 'Break', start: clockHm(at), end: clockHm(at + mins) })
      at += mins
    }
  }
  return rows
}

/** period → {start, end} ({} when timings are unknown). */
export function periodTimes(tm) {
  const out = {}
  if (!tm) return out
  for (const r of buildSchedule(tm)) if (r.kind === 'period') out[r.period] = { start: r.start, end: r.end }
  return out
}

export const periodCount = (tm) =>
  Math.min(MAX_PERIODS_PER_DAY, Math.max(1, Number(tm?.periods_per_day) || DEFAULT_PERIODS_PER_DAY))
