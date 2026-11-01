import React, { useEffect, useState } from 'react'
import { api, fmtDate, fmtDateTime, photoUrl } from '../api.js'
import { Avatar, DateInput, Donut, Empty, Field, Modal, StatCard } from '../components/ui.jsx'

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
const CLAIM_BADGE = { pending: 'amber', approved: 'green', rejected: 'red' }

export default function Fees() {
  const [stats, setStats] = useState(null)
  const [items, setItems] = useState(null)
  const [pending, setPending] = useState(null)
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genForm, setGenForm] = useState({ class_id: '', title: '', due_date: '' })
  const [genResult, setGenResult] = useState('')
  const [paying, setPaying] = useState(null) // fee row
  const [method, setMethod] = useState('cash')
  const [form, setForm] = useState({ student_id: '', title: '', amount: '', due_date: '' })
  const [claims, setClaims] = useState(null)
  const [claimStats, setClaimStats] = useState(null)
  const [claimFilter, setClaimFilter] = useState('pending')
  const [reviewing, setReviewing] = useState(null) // claim row
  const [reviewNote, setReviewNote] = useState('')

  async function load() {
    try {
      setStats(await api('/fees/stats'))
      setItems(await api('/fees' + (filter ? `?status_filter=${filter}` : '')))
      setPending(await api('/fees/pending-students'))
      loadClaims()
    } catch (e) {
      setError(e.message)
    }
  }

  async function loadClaims() {
    try {
      setClaimStats(await api('/fees/claims/stats'))
      setClaims(await api('/fees/claims' + (claimFilter ? `?status_filter=${claimFilter}` : '')))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { loadClaims() }, [claimFilter])

  async function review(claim, action) {
    try {
      await api(`/fees/claims/${claim.id}/${action}`, {
        method: 'PUT',
        body: { note: reviewNote || null, method: claim.method },
      })
      setReviewing(null)
      setReviewNote('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }
  useEffect(() => { load() }, [filter])
  useEffect(() => {
    api('/students').then(setStudents).catch(() => {})
    api('/classes').then(setClasses).catch(() => {})
  }, [])

  async function generate(e) {
    e.preventDefault()
    setError('')
    try {
      const res = await api('/fees/generate', {
        method: 'POST',
        body: {
          class_id: Number(genForm.class_id),
          title: genForm.title,
          due_date: genForm.due_date || null,
        },
      })
      setGenResult(`Created ${res.created} fee records (class has ${res.students} students).`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const genClass = classes.find((c) => c.id === Number(genForm.class_id))

  async function submit(e) {
    e.preventDefault()
    try {
      await api('/fees', {
        method: 'POST',
        body: {
          student_id: Number(form.student_id),
          title: form.title,
          amount: Number(form.amount),
          due_date: form.due_date || null,
        },
      })
      setForm({ student_id: '', title: '', amount: '', due_date: '' })
      setCreating(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function pay(e) {
    e.preventDefault()
    try {
      await api(`/fees/${paying.id}/pay`, { method: 'PUT', body: { method } })
      setPaying(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this fee record?')) return
    try {
      await api(`/fees/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const badge = { paid: 'green', pending: 'amber', overdue: 'red' }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Fees Overview</h2>
          <p>Create fee records per student and mark them paid.</p>
        </div>
        <div className="row-right fit">
          <button className="soft" onClick={() => { setGenerating(true); setGenResult('') }}>
            ⚙️ Generate class fees
          </button>
          <button onClick={() => setCreating(true)}>+ Add fee</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <StatCard icon="💰" label="Collected" value={stats && inr(stats.collected)} tone="green" />
        <StatCard icon="⏳" label="Pending" value={stats && inr(stats.pending)} tone="amber" />
        <StatCard icon="⚠️" label="Overdue" value={stats && inr(stats.overdue)} tone="red" />
        <StatCard icon="📈" label="Collection rate" value={stats && `${stats.collection_rate}%`} tone="blue" />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        {/* collection donut */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>Collection so far</h3>
          {!stats ? (
            <div className="skeleton">Loading…</div>
          ) : stats.total === 0 ? (
            <Empty icon="💰" text="No fee records yet." />
          ) : (
            <div className="row center" style={{ gap: 18 }}>
              <Donut
                center={`${stats.collection_rate}%`}
                centerSub="collected"
                segments={[
                  { value: stats.collected, color: 'var(--brand)' },
                  { value: stats.pending, color: '#f2b13c' },
                  { value: stats.overdue, color: 'var(--danger)' },
                ]}
              />
              <div className="legend" style={{ flex: 1, minWidth: 150 }}>
                {[
                  ['Paid', stats.collected, 'var(--brand)'],
                  ['Pending', stats.pending, '#f2b13c'],
                  ['Overdue', stats.overdue, 'var(--danger)'],
                ].map(([l, v, c]) => (
                  <div className="li" key={l}>
                    <span className="swatch" style={{ background: c }} />
                    {l}<span className="amt">{inr(v)}</span>
                  </div>
                ))}
                <div className="li" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                  Total billed<span className="amt">{inr(stats.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* students with pending fees */}
        <div className="card" style={{ marginBottom: 0, maxHeight: 320, overflowY: 'auto' }}>
          <h3>Students with pending fees</h3>
          {!pending ? (
            <div className="skeleton">Loading…</div>
          ) : pending.length === 0 ? (
            <Empty icon="🎉" text="Nobody owes anything. Rare sight!" />
          ) : (
            pending.map((p) => (
              <div className="activity" key={p.student_id}>
                <Avatar name={p.full_name} photo={p.photo_path} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{p.full_name}</b>
                  <span className="sub">
                    {p.class_name || '—'}{p.section_name ? ` / ${p.section_name}` : ''}
                    {' · '}{p.pending_count} pending
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <b>{inr(p.pending_total)}</b>
                  {Number(p.overdue_total) > 0 && (
                    <div className="small" style={{ color: 'var(--danger)', fontWeight: 700 }}>
                      {inr(p.overdue_total)} overdue
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* parent-submitted payment claims */}
      <div className="card">
        <div className="row center" style={{ marginBottom: 12 }}>
          <h3 style={{ flex: 1, marginBottom: 0 }}>
            Payment claims
            {claimStats?.pending > 0 && (
              <span className="badge amber" style={{ marginLeft: 8 }}>
                {claimStats.pending} awaiting review
              </span>
            )}
          </h3>
          <select className="fit" style={{ width: 140 }} value={claimFilter}
            onChange={(e) => setClaimFilter(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <p className="muted small" style={{ marginTop: -6, marginBottom: 12 }}>
          Proof screenshots submitted by parents from the mobile app. Approving marks the fee
          paid and records a transaction.
        </p>
        {!claims ? (
          <div className="skeleton">Loading…</div>
        ) : claims.length === 0 ? (
          <Empty icon="🧾" text={claimFilter ? `No ${claimFilter} claims.` : 'No claims yet.'} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th><th>Fee</th><th>Amount</th><th>Method / Ref</th>
                  <th>Proof</th><th>Submitted</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="row center" style={{ gap: 10, flexWrap: 'nowrap' }}>
                        <Avatar name={c.student_name} photo={c.photo_path} size={30} />
                        <div>
                          <b>{c.student_name}</b>
                          <div className="small muted">
                            {c.class_name || '—'}{c.section_name ? ` / ${c.section_name}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{c.fee_title}</td>
                    <td style={{ fontWeight: 700 }}>{inr(c.amount ?? c.fee_amount)}</td>
                    <td className="small">
                      {String(c.method).toUpperCase()}
                      {c.reference_no ? <div className="muted">#{c.reference_no}</div> : null}
                    </td>
                    <td>
                      <button className="filelink" onClick={() => { setReviewing(c); setReviewNote('') }}>
                        🖼️ Screenshot
                      </button>
                    </td>
                    <td className="small">{fmtDateTime(c.created_at)}</td>
                    <td>
                      <span className={`badge ${CLAIM_BADGE[c.status]}`}>{c.status}</span>
                      {c.reviewed_by_name && (
                        <div className="small muted">by {c.reviewed_by_name}</div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {c.status === 'pending' && (
                        <button className="soft" style={{ padding: '5px 11px' }}
                          onClick={() => { setReviewing(c); setReviewNote('') }}>
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="row center" style={{ marginBottom: 12 }}>
          <h3 style={{ flex: 1, marginBottom: 0 }}>Fee records</h3>
          <select className="fit" style={{ width: 140 }} value={filter}
            onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        {!items ? (
          <div className="skeleton">Loading…</div>
        ) : items.length === 0 ? (
          <Empty icon="💰" text="No fee records yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th><th>Class</th><th>Fee</th><th>Amount</th>
                  <th>Due date</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.student_name}</td>
                    <td>
                      {f.class_name || '—'}
                      {f.section_name ? ` / ${f.section_name}` : ''}
                    </td>
                    <td>{f.title}</td>
                    <td style={{ fontWeight: 700 }}>{inr(f.amount)}</td>
                    <td>{fmtDate(f.due_date)}</td>
                    <td><span className={`badge ${badge[f.effective_status]}`}>{f.effective_status}</span></td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {f.status !== 'paid' && (
                        <button className="soft" style={{ padding: '5px 11px', marginRight: 6 }}
                          onClick={() => { setPaying(f); setMethod('cash') }}>
                          Mark paid
                        </button>
                      )}
                      <button className="danger" onClick={() => remove(f.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <Modal error={error} title="Add fee record" onClose={() => setCreating(false)}>
          <form onSubmit={submit} className="grid">
            <Field label="Student">
              <select value={form.student_id} required
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                <option value="">Select…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}{s.class_name ? ` (${s.class_name} ${s.section_name || ''})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid cols-2">
              <Field label="Title">
                <input value={form.title} placeholder="e.g. Term 1 Fees 2026" required
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Amount (₹)">
                <input type="number" min="1" step="0.01" value={form.amount} required
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </Field>
              <Field label="Due date">
                <DateInput value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </Field>
            </div>
            <button>Add fee</button>
          </form>
        </Modal>
      )}

      {generating && (
        <Modal error={error} title="Generate class fees" onClose={() => setGenerating(false)}>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Creates one fee record (the class's standard fee) for every student in the class.
            Students who already have a fee with the same title are skipped.
          </p>
          <form onSubmit={generate} className="grid">
            <Field label="Class">
              <select value={genForm.class_id} required
                onChange={(e) => setGenForm({ ...genForm, class_id: e.target.value })}>
                <option value="">Select…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.fee_amount ? ` — ${inr(c.fee_amount)}` : ' (no fee set!)'}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid cols-2">
              <Field label="Title">
                <input value={genForm.title} placeholder="e.g. Term 2 Fees 2026" required
                  onChange={(e) => setGenForm({ ...genForm, title: e.target.value })} />
              </Field>
              <Field label="Due date">
                <DateInput value={genForm.due_date}
                  onChange={(e) => setGenForm({ ...genForm, due_date: e.target.value })} />
              </Field>
            </div>
            {genClass && !genClass.fee_amount && (
              <div className="error" style={{ marginBottom: 0 }}>
                {genClass.name} has no fee amount set — set it on the Classes page first.
              </div>
            )}
            {genResult && <span className="badge green">{genResult}</span>}
            <button disabled={genClass && !genClass.fee_amount}>Generate</button>
          </form>
        </Modal>
      )}

      {reviewing && (
        <Modal error={error}
          title={`Payment claim — ${reviewing.student_name} · ${inr(reviewing.amount ?? reviewing.fee_amount)}`}
          onClose={() => setReviewing(null)}
          wide
        >
          <div className="grid" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="badge blue">{reviewing.fee_title}</span>
              <span className="badge gray">{String(reviewing.method).toUpperCase()}</span>
              {reviewing.reference_no && <span className="badge gray">Ref #{reviewing.reference_no}</span>}
              <span className={`badge ${CLAIM_BADGE[reviewing.status]}`}>{reviewing.status}</span>
            </div>
            {reviewing.note && (
              <p className="small" style={{ margin: 0 }}>
                <b>Parent's note:</b> {reviewing.note}
              </p>
            )}
            <img
              src={photoUrl(reviewing.screenshot_path)}
              alt="Payment proof"
              style={{
                width: '100%', maxHeight: '55vh', objectFit: 'contain',
                border: '1px solid var(--line)', borderRadius: 10, background: 'var(--page)',
              }}
            />
            {reviewing.status === 'pending' ? (
              <>
                <Field label="Review note (optional)">
                  <input value={reviewNote} placeholder="e.g. Verified against bank statement"
                    onChange={(e) => setReviewNote(e.target.value)} />
                </Field>
                <div className="row" style={{ gap: 8 }}>
                  <button style={{ flex: 1 }} onClick={() => review(reviewing, 'approve')}>
                    ✅ Approve & mark paid
                  </button>
                  <button className="danger" style={{ flex: 1 }}
                    onClick={() => review(reviewing, 'reject')}>
                    ✕ Reject
                  </button>
                </div>
              </>
            ) : (
              reviewing.review_note && (
                <p className="small muted" style={{ margin: 0 }}>
                  <b>Review note:</b> {reviewing.review_note}
                </p>
              )
            )}
          </div>
        </Modal>
      )}

      {paying && (
        <Modal error={error} title={`Mark paid — ${paying.student_name} · ${inr(paying.amount)}`}
          onClose={() => setPaying(null)}>
          <form onSubmit={pay} className="grid">
            <Field label="Payment method">
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="netbanking">Net banking</option>
                <option value="wallet">Wallet</option>
              </select>
            </Field>
            <button>Confirm payment</button>
          </form>
        </Modal>
      )}
    </>
  )
}
