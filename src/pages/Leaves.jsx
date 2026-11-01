import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { MANAGERS, api, fmtDate } from '../api.js'
import SubstituteFinder, { picksToBody } from '../components/SubstituteFinder.jsx'
import { Avatar, DateInput, Empty, ErrorBox, Field, Modal, Pager, Toggle } from '../components/ui.jsx'
import usePagedList from '../hooks/usePagedList.js'
import { localISODate } from '../lib/format.js'
import { roleLabel } from '../lib/roles.js'

const TONES = { pending: 'amber', approved: 'green', rejected: 'red', cancelled: 'gray' }
const days = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000) + 1

const editable = (l) => l.status === 'pending'
const cancellable = (l) => l.status === 'pending' || (l.status === 'approved' && l.from_date > localISODate())

function Coverage({ l }) {
  const c = l.coverage
  if (!c?.periods) return <span className="muted">—</span>
  const all = c.covered >= c.periods
  return (
    <span className={`badge ${all ? 'green' : 'amber'}`} title={c.pending ? `${c.pending} waiting for reply` : undefined}>
      🔁 {c.covered}/{c.periods} covered
    </span>
  )
}

/**
 * Leave requests: staff create / edit / delete their own (with the
 * substitute finder), managers also review everyone's.
 */
export default function Leaves({ user }) {
  const isManager = MANAGERS.includes(user.user_type)
  const [tab, setTab] = useState(isManager ? 'all' : 'mine')
  const list = usePagedList(tab === 'mine' ? '/leaves/mine' : '/leaves', 20)
  const [editing, setEditing] = useState(null) // null | {} (new) | leave
  const [reviewing, setReviewing] = useState(null)
  const [error, setError] = useState('')

  async function remove(l) {
    const what = l.status === 'approved' ? 'Cancel this approved leave' : 'Delete this leave request'
    if (!confirm(`${what} (${fmtDate(l.from_date)} → ${fmtDate(l.to_date)})?\nIts substitute requests are withdrawn too.`)) return
    try {
      await api(`/leaves/${l.id}`, { method: 'DELETE' })
      list.reload()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <div className="page-head split">
        <div>
          <h2>Leave requests</h2>
          <p>Apply for leave and arrange substitute teachers for your classes.</p>
        </div>
        <div className="row-right">
          {user.user_type !== 'driver' && (
            <Link to="/substitutions"><button className="ghost">🔁 Substitute requests</button></Link>
          )}
          <button onClick={() => setEditing({})}>+ Request leave</button>
        </div>
      </div>

      {isManager && (
        <div className="tabs">
          {[['all', '📥 All requests'], ['mine', '🧳 My requests']].map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      )}
      <ErrorBox error={error || list.error} />

      <div className="card">
        {!list.rows ? (
          <div className="skeleton">Loading…</div>
        ) : list.rows.length === 0 ? (
          <Empty icon="🧳" text="No leave requests yet." />
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  {tab === 'all' && <th>Staff</th>}
                  <th>Dates</th><th>Reason</th><th>Substitutes</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {list.rows.map((l) => {
                  const mine = tab === 'mine' || l.user_id === user.id || l.user_id === user.user_id
                  return (
                    <tr key={l.id}>
                      {tab === 'all' && (
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={l.full_name} photo={l.photo_path} size={30} />
                            <div>
                              <b>{l.full_name}</b>
                              <div className="muted small">{roleLabel(l.user_type)}</div>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="whitespace-nowrap">
                        <b>{fmtDate(l.from_date)} → {fmtDate(l.to_date)}</b>
                        <div className="muted small">{days(l.from_date, l.to_date)} day(s)</div>
                      </td>
                      <td className="max-w-[260px]">
                        {l.reason}
                        {l.reviewed_by_name && (
                          <div className="muted small mt-1">
                            Reviewed by {l.reviewed_by_name}{l.review_note ? ` — ${l.review_note}` : ''}
                          </div>
                        )}
                      </td>
                      <td><Coverage l={l} /></td>
                      <td><span className={`badge ${TONES[l.status] || 'gray'}`}>{l.status}</span></td>
                      <td className="actions">
                        {tab === 'all' && isManager && l.status === 'pending' && (
                          <button className="soft sm" onClick={() => setReviewing(l)}>Review</button>
                        )}
                        {mine && editable(l) && <button className="ghost sm" onClick={() => setEditing(l)}>Edit</button>}
                        {mine && cancellable(l) && (
                          <button className="danger sm" onClick={() => remove(l)}>
                            {l.status === 'approved' ? 'Cancel' : 'Delete'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
      </div>

      {editing && (
        <LeaveModal user={user} leave={editing.id ? editing : null}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload() }} />
      )}
      {reviewing && (
        <ReviewModal leave={reviewing} onClose={() => setReviewing(null)}
          onDone={() => { setReviewing(null); list.reload() }} />
      )}
    </>
  )
}

/** Create / edit a leave — with "Find substitute" (see the mock-up). */
function LeaveModal({ user, leave, onClose, onSaved }) {
  const teaches = user.user_type !== 'driver'
  const [form, setForm] = useState({
    from_date: leave?.from_date?.slice(0, 10) || '',
    to_date: leave?.to_date?.slice(0, 10) || '',
    reason: leave?.reason || '',
  })
  const [find, setFind] = useState(teaches && !!leave?.coverage?.periods)
  const [picks, setPicks] = useState({})
  const [sent, setSent] = useState([]) // requests sent with "Request" before the leave exists
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e?.preventDefault()
    setError('')
    if (!form.from_date || !form.to_date) return setError('Pick the from and to dates.')
    if (form.to_date < form.from_date) return setError('The end date is before the start date.')
    if (!form.reason.trim()) return setError('Please give a reason.')
    setBusy(true)
    try {
      const body = {
        ...form,
        reason: form.reason.trim(),
        substitutions: find ? picksToBody(picks, form.from_date, form.to_date) : [],
      }
      if (leave) await api(`/leaves/${leave.id}`, { method: 'PUT', body })
      else await api('/leaves', { method: 'POST', body })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function close() {
    // "Request" sent some requests but the leave was never submitted: offer to take them back.
    if (!leave && sent.length && confirm(`Withdraw the ${sent.length} substitute request(s) you already sent?`)) {
      await Promise.all(sent.map((id) => api(`/substitutions/${id}/cancel`, { method: 'PUT' }).catch(() => {})))
    }
    onClose()
  }

  const queued = Object.values(picks).reduce((a, ids) => a + ids.length, 0)

  return (
    <Modal xl title={leave ? 'Edit leave request' : 'Request leave'} onClose={close} error={error}
      footer={
        <>
          <button type="button" className="ghost min-w-[120px]" onClick={close}>Cancel</button>
          <button type="button" className="min-w-[160px]" disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : leave ? 'Save changes' : 'Submit request'}
            {queued ? ` · ${queued} request${queued === 1 ? '' : 's'}` : ''}
          </button>
        </>
      }>
      <form onSubmit={submit} className="grid">
        <div className="grid cols-2">
          <Field label="From *">
            <DateInput value={form.from_date} required
              onChange={(e) => {
                const v = e.target.value
                setForm((f) => ({ ...f, from_date: v, to_date: f.to_date && f.to_date < v ? v : f.to_date }))
              }} />
          </Field>
          <Field label="To *">
            <DateInput value={form.to_date} required min={form.from_date || undefined}
              onChange={(e) => setForm((f) => ({ ...f, to_date: e.target.value }))} />
          </Field>
        </div>

        {teaches && (
          <div className="feature-card mb-0">
            <span className="text-[22px]">👥</span>
            <div className="min-w-0 flex-1">
              <b>Find substitute</b>
              <div className="muted small">Find and request teachers to cover your classes for the selected dates.</div>
            </div>
            <Toggle checked={find} onChange={setFind} label="Find substitute" />
          </div>
        )}
        {teaches && find && (
          <SubstituteFinder from={form.from_date} to={form.to_date} leaveId={leave?.id}
            picks={picks} onPicks={setPicks} onSent={(id) => setSent((s) => [...s, id])} />
        )}

        <Field label="Reason *">
          <textarea rows={3} value={form.reason} placeholder="Enter reason for leave…"
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </Field>
        {find && (
          <p className="muted small -mt-1">
            ☑️ Ticked teachers are requested when you submit · <b>Request</b> sends one right away.
            If several teachers are asked for one period, the first to accept takes it.
          </p>
        )}
      </form>
    </Modal>
  )
}

function ReviewModal({ leave, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function review(action) {
    setBusy(true)
    setError('')
    try {
      await api(`/leaves/${leave.id}/${action}`, { method: 'PUT', body: { note: note.trim() || null } })
      onDone()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`${leave.full_name} · ${fmtDate(leave.from_date)} → ${fmtDate(leave.to_date)}`} onClose={onClose} error={error}>
      <div className="grid">
        <div>{leave.reason}</div>
        <div><Coverage l={leave} /></div>
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="btn-row">
          <button className="flex-1" disabled={busy} onClick={() => review('approve')}>✅ Approve</button>
          <button className="danger flex-1 py-[9px]" disabled={busy} onClick={() => review('reject')}>✕ Reject</button>
        </div>
        <p className="muted small">Rejecting also withdraws its substitute requests.</p>
      </div>
    </Modal>
  )
}
