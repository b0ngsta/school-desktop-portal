import React, { useEffect, useState } from 'react'
import { MANAGERS, api } from '../api.js'
import { Empty, ErrorBox, Field, Modal, Pager } from '../components/ui.jsx'
import usePagedList from '../hooks/usePagedList.js'
import { roleLabel } from '../lib/roles.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
const TONES = { paid: 'green', pending: 'amber', processing: 'blue' }

/** Salary statements: staff see their own; managers also record salaries for anyone. */
export default function Salary({ user }) {
  const isManager = MANAGERS.includes(user.user_type)
  const [tab, setTab] = useState('mine')
  const list = usePagedList(tab === 'mine' ? '/salaries/mine' : '/salaries', 25)
  const [adding, setAdding] = useState(false)

  return (
    <>
      <div className="page-head split">
        <div>
          <h2>Salary</h2>
          <p>{isManager ? 'Monthly salary statements for every staff member.' : 'Your monthly salary statements.'}</p>
        </div>
        {isManager && <button onClick={() => setAdding(true)}>+ Record salary</button>}
      </div>
      {isManager && (
        <div className="tabs">
          {[['mine', '💵 My salary'], ['all', '👥 All staff']].map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      )}
      <ErrorBox error={list.error} />
      <div className="card">
        {!list.rows ? (
          <div className="skeleton">Loading…</div>
        ) : list.rows.length === 0 ? (
          <Empty icon="💵" text="No salary statements yet." />
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th>Month</th>{tab === 'all' && <th>Staff</th>}<th>Amount</th><th>Status</th><th>Note</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((s) => (
                  <tr key={s.id}>
                    <td><b>{MONTHS[s.month - 1]} {s.year}</b></td>
                    {tab === 'all' && (
                      <td>{s.full_name}<div className="muted small">{roleLabel(s.user_type)}</div></td>
                    )}
                    <td className="font-bold">{inr(s.amount)}</td>
                    <td><span className={`badge ${TONES[s.status] || 'gray'}`}>{s.status}</span></td>
                    <td className="muted">{s.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
      </div>
      {adding && <RecordModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); list.reload() }} />}
    </>
  )
}

function RecordModal({ onClose, onSaved }) {
  const now = new Date()
  const [staff, setStaff] = useState([])
  const [form, setForm] = useState({ user_id: '', month: now.getMonth() + 1, year: now.getFullYear(), amount: '', note: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/users?limit=500').then((u) => setStaff((u || []).filter((x) => x.user_type !== 'student'))).catch((e) => setError(e.message))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/salaries', {
        method: 'POST',
        body: { ...form, user_id: Number(form.user_id), month: Number(form.month), year: Number(form.year),
          amount: Number(form.amount), note: form.note.trim() || null },
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return (
    <Modal title="Record salary" onClose={onClose} error={error}>
      <form onSubmit={submit} className="grid">
        <Field label="Staff member">
          <select value={form.user_id} onChange={set('user_id')} required>
            <option value="">Select…</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.full_name} · {roleLabel(u.user_type)}</option>)}
          </select>
        </Field>
        <div className="grid cols-3">
          <Field label="Month">
            <select value={form.month} onChange={set('month')}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
          <Field label="Year">
            <input type="number" min={2000} max={2100} value={form.year} onChange={set('year')} required />
          </Field>
          <Field label="Amount (₹)">
            <input type="number" min={1} step="any" value={form.amount} onChange={set('amount')} required />
          </Field>
        </div>
        <Field label="Note (optional)"><input value={form.note} onChange={set('note')} /></Field>
        <button disabled={busy}>{busy ? 'Saving…' : 'Save salary record'}</button>
      </form>
    </Modal>
  )
}
