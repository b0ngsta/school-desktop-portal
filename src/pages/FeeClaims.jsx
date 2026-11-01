import React, { useEffect, useState } from 'react'
import { api, fmtDate, photoUrl } from '../api.js'
import { Avatar, Empty, ErrorBox, Field, Modal, Pager, StatCard } from '../components/ui.jsx'
import usePagedList from '../hooks/usePagedList.js'

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
const TONES = { pending: 'amber', approved: 'green', rejected: 'red' }

/** Parents' "I paid this fee" claims with a payment screenshot — approve (marks the fee paid) or reject. */
export default function FeeClaims() {
  const [filter, setFilter] = useState('pending')
  const list = usePagedList(filter ? `/fees/claims?status_filter=${filter}` : '/fees/claims', 20)
  const [stats, setStats] = useState(null)
  const [reviewing, setReviewing] = useState(null)

  const loadStats = () => api('/fees/claims/stats').then(setStats).catch(() => {})
  useEffect(() => { loadStats() }, [])

  return (
    <>
      <div className="page-head">
        <h2>Fee claims</h2>
        <p>Payment proofs sent by parents from the app. Approving marks the fee as paid and records a transaction.</p>
      </div>
      <div className="grid cols-3 mb-5">
        <StatCard icon="⏳" label="Waiting for review" value={stats?.pending} tone="amber" />
        <StatCard icon="✅" label="Approved" value={stats?.approved} tone="green" />
        <StatCard icon="✕" label="Rejected" value={stats?.rejected ?? '—'} tone="red" />
      </div>
      <div className="filter-chips">
        {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']].map(([v, l]) => (
          <button key={v || 'all'} className={`chip-btn ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>
      <ErrorBox error={list.error} />
      <div className="card">
        {!list.rows ? (
          <div className="skeleton">Loading…</div>
        ) : list.rows.length === 0 ? (
          <Empty icon="🧾" text={filter ? `No ${filter} claims.` : 'No claims.'} />
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 720 }}>
              <thead>
                <tr><th>Student</th><th>Fee</th><th>Amount</th><th>Method</th><th>Sent</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {list.rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.student_name} photo={c.photo_path} size={30} />
                        <div>
                          <b>{c.student_name}</b>
                          <div className="muted small">{c.class_name || '—'}{c.section_name ? ` / ${c.section_name}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>{c.fee_title}</td>
                    <td className="font-bold">{inr(c.amount ?? c.fee_amount)}</td>
                    <td>{String(c.method || '').toUpperCase()}{c.reference_no ? <div className="muted small">#{c.reference_no}</div> : null}</td>
                    <td className="muted">{fmtDate(c.created_at)}</td>
                    <td><span className={`badge ${TONES[c.status] || 'gray'}`}>{c.status}</span></td>
                    <td className="actions">
                      <button className="soft sm" onClick={() => setReviewing(c)}>
                        {c.status === 'pending' ? 'View & review' : 'View proof'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
      </div>
      {reviewing && (
        <ReviewModal claim={reviewing} onClose={() => setReviewing(null)}
          onDone={() => { setReviewing(null); list.reload(); loadStats() }} />
      )}
    </>
  )
}

function ReviewModal({ claim, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function review(action) {
    setBusy(true)
    setError('')
    try {
      await api(`/fees/claims/${claim.id}/${action}`, { method: 'PUT', body: { note: note.trim() || null } })
      onDone()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const shot = photoUrl(claim.screenshot_path)
  return (
    <Modal wide title={`${claim.student_name} · ${inr(claim.amount ?? claim.fee_amount)}`} onClose={onClose} error={error}>
      <div className="grid">
        {shot ? (
          <a href={shot} target="_blank" rel="noreferrer">
            <img src={shot} alt="Payment proof" className="max-h-[60vh] w-full rounded-xl border border-line bg-page object-contain" />
          </a>
        ) : <div className="notice">No screenshot attached.</div>}
        <div className="small">
          <b>{claim.fee_title}</b> · {String(claim.method || '').toUpperCase()}
          {claim.reference_no ? ` · #${claim.reference_no}` : ''}
          {claim.note && <div className="muted mt-1">💬 {claim.note}</div>}
          {claim.reviewed_by_name && (
            <div className="muted mt-1">Reviewed by {claim.reviewed_by_name}{claim.review_note ? ` — ${claim.review_note}` : ''}</div>
          )}
        </div>
        {claim.status === 'pending' && (
          <>
            <Field label="Review note (optional)">
              <input value={note} placeholder="e.g. Verified against bank statement" onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="btn-row">
              <button className="flex-1" disabled={busy} onClick={() => review('approve')}>✅ Approve</button>
              <button className="danger flex-1 py-[9px]" disabled={busy} onClick={() => review('reject')}>✕ Reject</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
