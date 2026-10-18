import React, { useMemo, useState } from 'react'
import { Empty } from '../../components/ui.jsx'

export const ACTIONS = {
  create: { label: 'New', tone: 'green' },
  update: { label: 'Updated', tone: 'blue' },
  unchanged: { label: 'Unchanged', tone: 'gray' },
  error: { label: 'Error', tone: 'red' },
}

const FILTERS = [
  ['all', 'All', (s) => s.rows],
  ['create', 'New', (s) => s.create],
  ['update', 'Updated', (s) => s.update],
  ['unchanged', 'Unchanged', (s) => s.unchanged],
  ['error', 'Errors', (s) => s.error],
]

/** Per-row import report with filter chips. `saved` switches the wording to past tense. */
export default function ReportTable({ report, saved = false, initialFilter = 'all' }) {
  const [filter, setFilter] = useState(initialFilter)
  const rows = useMemo(
    () => (filter === 'all' ? report.rows : report.rows.filter((r) => r.action === filter)),
    [report.rows, filter]
  )

  return (
    <>
      <div className="filter-chips" role="tablist">
        {FILTERS.map(([id, label, count]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id}
            className={`chip-btn ${filter === id ? 'active' : ''} ${id === 'error' && report.summary.error ? 'has-errors' : ''}`}
            onClick={() => setFilter(id)}>
            {label} <span className="count">{count(report.summary) ?? 0}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty icon="📄" text="No rows in this view." />
      ) : (
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr><th>Row</th><th>Username</th><th>Name</th><th>Result</th><th>Details</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row} className={r.action === 'error' ? 'row-error' : r.warnings.length ? 'row-warn' : ''}>
                  <td className="muted">{r.row}</td>
                  <td>{r.username || <span className="muted">—</span>}</td>
                  <td>{r.full_name || '—'}</td>
                  <td>
                    <span className={`badge ${ACTIONS[r.action]?.tone || 'gray'}`}>
                      {r.action === 'error' && saved ? 'Skipped' : ACTIONS[r.action]?.label || r.action}
                    </span>
                  </td>
                  <td>
                    <RowDetails row={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function RowDetails({ row }) {
  const parts = []
  if (row.errors.length) {
    parts.push(<ul key="e" className="msg-list error-text">{row.errors.map((m, i) => <li key={i}>{m}</li>)}</ul>)
  }
  if (row.warnings.length) {
    parts.push(<ul key="w" className="msg-list warn-text">{row.warnings.map((m, i) => <li key={i}>{m}</li>)}</ul>)
  }
  if (row.action === 'update' && row.changes.length) {
    parts.push(<div key="c" className="muted small">Changes: {row.changes.join(', ')}</div>)
  }
  return parts.length ? parts : <span className="muted">—</span>
}
