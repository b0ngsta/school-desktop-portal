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
