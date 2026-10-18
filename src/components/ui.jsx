import React, { useEffect, useRef, useState } from 'react'
import { fetchPdfBlob, photoUrl } from '../api.js'
import { emailError, EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../lib/validators.js'

export function Avatar({ name, photo, size = 36 }) {
  const url = photoUrl(photo)
  // signed photo links expire: fall back to the initial instead of a broken image
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  return (
    <div
      className="avatar"
      style={{
        width: size, height: size, minWidth: size, maxWidth: size,
        flex: '0 0 auto', fontSize: size * 0.42,
      }}
    >
      {url && !failed ? (
        <img src={url} alt={name} onError={() => setFailed(true)} />
      ) : (
        name?.[0]?.toUpperCase() || '?'
      )}
    </div>
  )
}

/** SVG donut chart. segments: [{value, color, label}] */
export function Donut({ segments, size = 170, center, centerSub }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  const r = 40
  const C = 2 * Math.PI * r
  let offset = 0
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
      {segments.map((s, i) => {
        const frac = s.value / total
        const el = (
          <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={s.color}
            strokeWidth="14" strokeDasharray={`${frac * C} ${C}`}
            strokeDashoffset={-offset * C} transform="rotate(-90 50 50)" />
        )
        offset += frac
        return el
      })}
      <text x="50" y="49" textAnchor="middle" fontSize="11" fontWeight="800"
        fill="var(--ink)">{center}</text>
      {centerSub && (
        <text x="50" y="61" textAnchor="middle" fontSize="6.5" fill="var(--muted)">
          {centerSub}
        </text>
      )}
    </svg>
  )
}

/** SVG line chart for the weekly attendance. points: [{day, percentage|null}] */
export function WeekLine({ points, height = 150 }) {
  const W = 320
  const H = 100
  const pad = 10
  const xs = (i) => pad + (i * (W - 2 * pad)) / Math.max(points.length - 1, 1)
  const ys = (v) => H - pad - ((v ?? 0) * (H - 2 * pad)) / 100
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(p.percentage).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} width="100%" height={height}>
      {[0, 25, 50, 75, 100].map((g) => (
        <line key={g} x1={pad} x2={W - pad} y1={ys(g)} y2={ys(g)}
          stroke="var(--line)" strokeWidth="0.6" />
      ))}
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          {p.percentage != null && (
            <circle cx={xs(i)} cy={ys(p.percentage)} r="3" fill="var(--brand)" />
          )}
          <text x={xs(i)} y={H + 10} textAnchor="middle" fontSize="7.5" fill="var(--muted)">
            {p.day}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** Inline PDF viewer modal (fetches with auth, shows in iframe). */
export function PdfModal({ path, title, onClose }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let u
    fetchPdfBlob(path).then((b) => { u = b; setUrl(b) }).catch((e) => setError(e.message))
    return () => u && URL.revokeObjectURL(u)
  }, [path])
  return (
    <Modal title={title} onClose={onClose} wide>
      {error && <div className="error">{error}</div>}
      {!url && !error && <div className="skeleton">Loading PDF…</div>}
      {url && (
        <iframe src={url} title={title}
          style={{ width: '100%', height: '70vh', border: '1px solid var(--line)', borderRadius: 10 }} />
      )}
    </Modal>
  )
}

/** `error`: optional message shown at the top (page errors are hidden behind the overlay). */
export function Modal({ title, onClose, children, wide, error }) {
  return (
    <div
      className="fixed inset-0 z-50 grid animate-fade place-items-center bg-ink/50 p-[18px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`max-h-[90vh] w-full animate-pop overflow-y-auto rounded-[18px] bg-white p-5 shadow-pop md:p-[26px] ${
          wide ? 'max-w-[760px]' : 'max-w-[620px]'
        }`}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <h3 className="flex-1 text-[17px] font-extrabold">{title}</h3>
          <button className="icon flex-none" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <ErrorBox error={error} />
        {children}
      </div>
    </div>
  )
}

export function StatCard({ icon, label, value, tone = 'brand' }) {
  const tones = {
    brand: ['var(--brand-soft)', 'var(--brand)'],
    green: ['var(--ok-soft)', 'var(--ok)'],
    amber: ['var(--warn-soft)', 'var(--warn)'],
    blue: ['var(--info-soft)', 'var(--info)'],
    red: ['var(--danger-soft)', 'var(--danger)'],
  }
  const [bg, fg] = tones[tone] || tones.brand
  return (
    <div className="stat">
      <div className="bubble" style={{ background: bg, color: fg }}>{icon}</div>
      <div>
        <div className="num">{value ?? '…'}</div>
        <div className="lbl">{label}</div>
      </div>
    </div>
  )
}

export function Empty({ icon = '🗂️', text = 'Nothing here yet.' }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      {text}
    </div>
  )
}

export function StatusBadge({ status }) {
  const map = {
    submitted: 'green',
    pending: 'amber',
    late: 'red',
    class_teacher: 'green',
    subject_teacher: 'blue',
  }
  return <span className={`badge ${map[status] || 'gray'}`}>{String(status).replace('_', ' ')}</span>
}

export function Field({ label, children }) {
  return (
    <div>
      <label>{label}</label>
      {children}
    </div>
  )
}

/**
 * Email input with the backend's format rules, wired into native form
 * validation (the browser shows the message and blocks submit).
 */
export function EmailInput({ value, onChange, required = true, ...rest }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.setCustomValidity(emailError(value, { required }))
  }, [value, required])
  return (
    <input ref={ref} type="email" inputMode="email" autoComplete="email" maxLength={EMAIL_MAX_LENGTH}
      required={required} value={value} onChange={onChange} {...rest} />
  )
}

/** Password input with a show/hide toggle. */
export function PasswordInput({ value, onChange, newPassword = false, ...rest }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="input-addon">
      <input type={shown ? 'text' : 'password'} value={value} onChange={onChange}
        autoComplete={newPassword ? 'new-password' : 'current-password'}
        minLength={newPassword ? PASSWORD_MIN_LENGTH : undefined} maxLength={PASSWORD_MAX_LENGTH} {...rest} />
      <button type="button" className="addon" onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}>
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

/** Error banner; `error` may be a string or an Error. */
export function ErrorBox({ error, className = '' }) {
  if (!error) return null
  return <div className={`error ${className}`} role="alert">{typeof error === 'string' ? error : error.message}</div>
}

/** Prev/next pager for {limit, offset, total} lists. Renders nothing for one page. */
export function Pager({ offset, limit, total, onChange }) {
  if (!total || total <= limit) return null
  const from = offset + 1
  const to = Math.min(offset + limit, total)
  return (
    <div className="pager">
      <span className="muted small">{from}–{to} of {total}</span>
      <button className="ghost" disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - limit))}>← Prev</button>
      <button className="ghost" disabled={to >= total}
        onClick={() => onChange(offset + limit)}>Next →</button>
    </div>
  )
}

/** Optional profile-photo picker with a live preview. */
export function PhotoPicker({ file, onChange, label = 'Profile picture (optional)' }) {
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return (
    <Field label={label}>
      <div className="photo-pick">
        {preview && <Avatar name="" photo={preview} size={38} />}
        <input type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => onChange(e.target.files[0] || null)} />
      </div>
    </Field>
  )
}
