/** Small formatting and browser helpers shared by pages. */

/** Today's date as YYYY-MM-DD in the user's time zone (toISOString() would give the UTC date). */
export function localISODate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 'YYYY-MM-DD' alone is parsed by Date as UTC midnight (the previous day west of UTC): read it as local.
const toDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d))

export const fmtDate = (d) => (d ? toDate(d).toLocaleDateString() : '—')
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—')

/** "45 seconds" / "3 minutes" for Retry-After style waits. */
export function fmtWait(seconds) {
  const s = Math.max(1, Math.round(Number(seconds) || 0))
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`
  const m = Math.ceil(s / 60)
  return `${m} minute${m === 1 ? '' : 's'}`
}

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`

/** Save a Blob as a file. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // revoke on the next tick: some browsers cancel the download if revoked synchronously
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Build a CSV (RFC 4180, with BOM so Excel reads UTF-8) from rows of cells. */
export function toCsv(rows) {
  const cell = (v) => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@]/.test(s)) s = `'${s}` // keep Excel from running it as a formula
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

const HM = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*([ap]\.?m\.?)?$/i

/** Minutes since midnight from "07:05", "7:05:33", "07:05:33.123", "7:05 pm"; null when unreadable. */
export function parseClock(value) {
  if (value == null) return null
  const m = HM.exec(String(value).trim())
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  const ampm = m[4]?.toLowerCase().replace(/\./g, '')
  if (ampm) {
    if (h < 1 || h > 12) return null
    if (ampm === 'pm' && h !== 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
  }
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

const wrap = (minutes) => ((Math.round(minutes) % 1440) + 1440) % 1440

/** 24h "HH:MM" from minutes since midnight. */
export function clockHm(minutes) {
  const m = wrap(minutes)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** "9:30 AM" from minutes since midnight. */
export function clock12(minutes) {
  const m = wrap(minutes)
  const h = Math.floor(m / 60)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * Any time the API sends → "9:30 AM": "09:30:12" (seconds dropped), "09:30",
 * ISO date-times (with an offset → local time; without → as written), Date,
 * numbers (seconds since midnight, or a Unix timestamp). "—" when empty.
 */
export function fmtTime(value) {
  if (value == null || value === '') return '—'
  if (value instanceof Date) return isNaN(value) ? '—' : clock12(value.getHours() * 60 + value.getMinutes())
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—'
    if (value < 86400) return clock12(Math.floor(value / 60))
    const d = new Date(value > 1e11 ? value : value * 1000)
    return clock12(d.getHours() * 60 + d.getMinutes())
  }
  const s = String(value).trim()
  const plain = parseClock(s)
  if (plain != null) return clock12(plain)
  const iso = /^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?$/i.exec(s)
  if (iso) {
    if (!iso[2]) return clock12(parseClock(iso[1]) ?? 0)
    const d = new Date(s.replace(' ', 'T'))
    if (!isNaN(d)) return clock12(d.getHours() * 60 + d.getMinutes())
  }
  return s
}

/** "9:30 AM – 10:15 AM" from two "HH:MM" strings ('' when unknown). */
export function timeRange(start, end) {
  const a = parseClock(start)
  const b = parseClock(end)
  if (a == null) return ''
  return b == null ? clock12(a) : `${clock12(a)} – ${clock12(b)}`
}

/** "Tue, 12 May" */
export function fmtDayShort(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d)
  if (isNaN(dt)) return String(d)
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

/** "Tue, 12 May 2026" */
export function fmtDayLong(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d)
  if (isNaN(dt)) return String(d)
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** "YYYY-MM-DD" plus n days. */
export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return localISODate(d)
}

/** Monday of the week containing `d`, as "YYYY-MM-DD". */
export function weekStart(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return localISODate(x)
}

/** "5 min ago" / "3 h ago" / a date. */
export function timeAgo(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} h ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
