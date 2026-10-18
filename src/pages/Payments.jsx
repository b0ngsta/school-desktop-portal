import React, { useEffect, useState } from 'react'
import { api, fmtDateTime } from '../api.js'
import { Empty, ErrorBox, Field, Modal, Pager, StatCard } from '../components/ui.jsx'
import usePagedList from '../hooks/usePagedList.js'

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
const TONES = { success: 'green', pending: 'amber', failed: 'red' }

export default function Payments() {
  const [stats, setStats] = useState(null)
  // paged: without ?limit the server only returns the latest 200
  const list = usePagedList('/transactions', 50)
  const items = list.rows
  const [students, setStudents] = useState([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ student_id: '', amount: '', method: 'cash', status: 'success' })

  async function load() {
    try {
      setStats(await api('/transactions/stats'))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
    api('/students').then(setStudents).catch(() => {})
  }, [])

  async function submit(e) {
    e.preventDefault()
    try {
      await api('/transactions', {
        method: 'POST',
        body: {
          student_id: form.student_id ? Number(form.student_id) : null,
          amount: Number(form.amount),
          method: form.method,
          status: form.status,
        },
      })
      setForm({ student_id: '', amount: '', method: 'cash', status: 'success' })
      setCreating(false)
      load()
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Payment Transactions</h2>
          <p>Every payment recorded — fee payments land here automatically.</p>
        </div>
        <button className="fit" onClick={() => setCreating(true)}>+ Record transaction</button>
      </div>
      <ErrorBox error={error || list.error} />

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <StatCard icon="💳" label="Today's collection" value={stats && inr(stats.today_collection)} tone="green" />
        <StatCard icon="🗓️" label="This month" value={stats && inr(stats.month_collection)} />
        <StatCard icon="🔢" label="Total transactions" value={stats?.total_transactions} tone="blue" />
        <StatCard icon="📈" label="Success rate" value={stats && `${stats.success_rate}%`} tone="amber" />
      </div>

      <div className="card">
        {!items ? (
          <div className="skeleton">Loading…</div>
        ) : items.length === 0 ? (
          <Empty icon="💳" text="No transactions yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th><th>Student</th><th>For</th><th>Amount</th>
                  <th>Method</th><th>Status</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className="muted">{t.reference}</td>
                    <td style={{ fontWeight: 600 }}>{t.student_name || '—'}</td>
                    <td>{t.fee_title || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{inr(t.amount)}</td>
                    <td style={{ textTransform: 'uppercase', fontSize: 12 }}>{t.method}</td>
                    <td><span className={`badge ${TONES[t.status]}`}>{t.status}</span></td>
                    <td className="muted small">{fmtDateTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
      </div>

      {creating && (
        <Modal error={error} title="Record transaction" onClose={() => setCreating(false)}>
          <form onSubmit={submit} className="grid">
            <Field label="Student (optional)">
              <select value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                <option value="">— none —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}{s.class_name ? ` (${s.class_name} ${s.section_name || ''})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid cols-3">
              <Field label="Amount (₹)">
                <input type="number" min="1" step="0.01" value={form.amount} required
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </Field>
              <Field label="Method">
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="netbanking">Net banking</option>
                  <option value="wallet">Wallet</option>
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="success">Success</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </Field>
            </div>
            <button>Save transaction</button>
          </form>
        </Modal>
      )}
    </>
  )
}
