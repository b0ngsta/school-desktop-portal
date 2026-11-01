import React, { useState } from 'react'
import { api, fmtDate } from '../api.js'
import { ErrorBox, Field, Modal } from './ui.jsx'

/**
 * People leaving the school. The server never deletes an account any more
 * (backend services/leaving.py): "Mark as left" closes it — no more sign-in,
 * off class lists, buses and timetables — and keeps everything recorded for
 * and by the person (attendance, fees, payments, marks, remarks, salary…).
 * A left account can be reactivated.
 */

const pathFor = (person) => (person.user_type === 'student' ? '/students' : '/users') + `/${person.id}`

/** Small badge for a left account. */
export function LeftBadge({ person }) {
  if (!person?.left_on) return null
  return (
    <span className="badge red fit" title={person.left_reason || undefined}>
      Left · {fmtDate(person.left_on)}
    </span>
  )
}

/** Confirm + optional reason, then mark the person as left. */
export function LeaveModal({ person, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const student = person.user_type === 'student'

  async function confirm(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const q = reason.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : ''
      await api(pathFor(person) + q, { method: 'DELETE' })
      onDone?.()
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Mark ${person.full_name} as left`} onClose={onClose}>
      <form className="grid" onSubmit={confirm}>
        <p className="small" style={{ margin: 0 }}>
          {student
            ? 'They leave their class list and bus, and the parent login stops working. Fees, payments, '
              + 'marks, attendance and remarks are all kept.'
            : 'They are signed out everywhere and can’t sign in any more. Their class assignments and '
              + 'timetable periods are removed; everything they recorded (attendance, remarks, notices, '
              + 'salary records…) is kept.'}
        </p>
        <p className="muted small" style={{ margin: 0 }}>You can reactivate the account later.</p>
        <Field label="Reason (optional)">
          <input value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)}
            placeholder={student ? 'e.g. TC issued, moved to another city' : 'e.g. Resigned'} />
        </Field>
        <ErrorBox error={error} className="mb-0" />
        <div className="row" style={{ gap: 8 }}>
          <button className="danger" style={{ flex: 1 }} disabled={busy}>
            {busy ? 'Saving…' : 'Mark as left'}
          </button>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

/** Give a left account its sign-in back. Returns a message to show (or throws). */
export async function reactivate(person) {
  const res = await api(`${pathFor(person)}/reactivate`, { method: 'POST' })
  if (res?.needs_class) return `${person.full_name} is back. Their old section no longer exists: put them in a class.`
  if (res?.roll_no_cleared) return `${person.full_name} is back in their section. Their old roll number was taken: give them a new one.`
  if (res?.section_id) return `${person.full_name} is back in their section.`
  return `${person.full_name} is active again.`
}
