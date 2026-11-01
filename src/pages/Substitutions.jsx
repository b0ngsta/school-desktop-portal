import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MANAGERS, api } from '../api.js'
import { Avatar, Empty, ErrorBox, Field, Modal, Pager } from '../components/ui.jsx'
import usePagedList from '../hooks/usePagedList.js'
import { fmtDayLong, timeRange } from '../lib/format.js'

const PATHS = { incoming: '/substitutions/incoming', outgoing: '/substitutions/outgoing', all: '/substitutions' }
const LABELS = {
  pending: ['Waiting for reply', 'amber'],
  accepted: ['Accepted', 'green'],
  declined: ['Declined', 'red'],
  cancelled: ['Cancelled', 'gray'],
  withdrawn: ['Withdrawn after accepting', 'red'],
  filled: ['Taken by another teacher', 'gray'],
}

/**
 * Substitute requests: accept / decline the ones sent to me (and undo an
 * accepted one), cancel the ones I sent; managers see every request.
 * ?tab=incoming|outgoing|all&id=<request id> (links from notifications).
 */
export default function Substitutions({ user }) {
  const isManager = MANAGERS.includes(user.user_type)
  const [params, setParams] = useSearchParams()
  const tab = PATHS[params.get('tab')] ? params.get('tab') : 'incoming'
  const highlight = Number(params.get('id')) || null
  const [status, setStatus] = useState('pending')
  const list = usePagedList(`${PATHS[tab]}${status ? `?status=${status}` : ''}`, 20)
  const [responding, setResponding] = useState(null) // {req, action}
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const setTab = (t) => setParams(t === 'incoming' ? {} : { tab: t })

  async function act(req, action, body) {
    setBusy(req.id)
    setError('')
    try {
      await api(`/substitutions/${req.id}/${action}`, { method: 'PUT', body })
      setResponding(null)
      list.reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>Substitute requests</h2>
        <p>Colleagues asking you to take their periods while they are on leave — and the ones you asked.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="tabs">
          {[['incoming', '📥 For me'], ['outgoing', '📤 Sent by me'], ...(isManager ? [['all', '🏫 All']] : [])].map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div className="filter-chips mb-[18px]">
          {[['pending', 'Waiting'], ['accepted', 'Accepted'], ['', 'All']].map(([v, label]) => (
            <button key={v || 'all'} className={`chip-btn ${status === v ? 'active' : ''}`} onClick={() => setStatus(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ErrorBox error={error || list.error} />

      {!list.rows ? (
        <div className="card"><div className="skeleton">Loading…</div></div>
      ) : list.rows.length === 0 ? (
        <div className="card">
          <Empty icon="🔁" text={tab === 'incoming' ? 'No substitute requests for you.' : 'No substitute requests.'} />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {list.rows.map((r) => {
            const incoming = tab === 'incoming' || (tab === 'all' && r.substitute_id === user.id)
            const outgoing = tab === 'outgoing' || (tab === 'all' && r.requester_id === user.id)
            const [label, tone] = LABELS[r.status] || [r.status, 'gray']
            const person = incoming ? r.requester_name : r.substitute_name
            const time = timeRange(r.start_time, r.end_time)
            return (
              <div key={r.id} className={`card mb-0 flex flex-col ${highlight === r.id ? 'ring-2 ring-brand' : ''}`}>
                <div className="flex items-start gap-2.5">
                  <Avatar name={person} photo={incoming ? r.requester_photo : r.substitute_photo} size={38} />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate">{tab === 'all' ? `${r.requester_name} → ${r.substitute_name}` : person}</b>
                    <div className="muted small">{incoming ? 'asks you to take a period' : 'asked to take your period'}</div>
                    <span className={`badge ${tone} mt-1.5`}>{label}</span>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-page px-3 py-2.5">
                  <b>{fmtDayLong(r.date)} · Period {r.period}</b>
                  {time && <span className="muted"> · {time}</span>}
                  <div className="muted small">{r.class_name} — {r.section_name}{r.subject ? ` · ${r.subject}` : ''}</div>
                </div>
                {r.note && <div className="small mt-2">💬 {r.note}</div>}
                {r.response_note && <div className="muted small mt-1">↩️ {r.response_note}</div>}
                <div className="flex-1" />
                <div className="btn-row mt-3">
                  {incoming && r.status === 'pending' && (
                    <>
                      <button className="sm" disabled={busy === r.id} onClick={() => act(r, 'accept')}>✅ Accept</button>
                      <button className="danger sm" disabled={busy === r.id}
                        onClick={() => setResponding({ req: r, action: 'decline' })}>✕ Decline</button>
                    </>
                  )}
                  {incoming && r.status === 'accepted' && r.can_withdraw !== false && (
                    <button className="ghost sm" disabled={busy === r.id}
                      onClick={() => setResponding({ req: r, action: 'withdraw' })}>↩️ Undo — I can’t take it</button>
                  )}
                  {outgoing && ['pending', 'accepted'].includes(r.status) && (
                    <button className="danger sm" disabled={busy === r.id}
                      onClick={() => confirm(`Cancel the request to ${r.substitute_name}?`) && act(r, 'cancel')}>
                      Cancel request
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />

      {responding && (
        <RespondModal {...responding} busy={busy === responding.req.id} error={error}
          onClose={() => setResponding(null)}
          onSubmit={(note) => act(responding.req, responding.action, { note: note || null })} />
      )}
    </>
  )
}

function RespondModal({ req, action, busy, error, onClose, onSubmit }) {
  const [note, setNote] = useState('')
  const withdraw = action === 'withdraw'
  return (
    <Modal title={withdraw ? 'Undo accepted substitution' : 'Decline request'} onClose={onClose} error={error}>
      <div className="grid">
        <p className="muted">
          {withdraw
            ? `The period is removed from your timetable and ${req.requester_name} is told to find someone else.`
            : `${req.requester_name} will be told you can’t take this period.`}
        </p>
        <Field label="Note (optional)">
          <input value={note} placeholder="e.g. I have a parent meeting then" onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button className="danger py-[9px]" disabled={busy} onClick={() => onSubmit(note.trim())}>
          {withdraw ? 'Undo and free the period' : 'Decline'}
        </button>
      </div>
    </Modal>
  )
}
