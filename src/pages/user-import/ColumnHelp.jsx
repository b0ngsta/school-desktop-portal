import React from 'react'

/**
 * Column table rendered from GET /imports/users/columns, so new backend
 * columns show up without a frontend release.
 */
export default function ColumnHelp({ info }) {
  return (
    <details className="disclosure">
      <summary>
        Columns ({info.columns.length}) · max {info.max_rows} rows, file {info.max_csv_mb} MB,
        photos ZIP {info.max_zip_mb} MB ({info.photo_max_mb} MB per photo)
      </summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Column</th><th>Needed for new users</th><th>Format</th><th>Example</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {info.columns.map((c) => (
              <tr key={c.name}>
                <td><code>{c.name}</code></td>
                <td>{c.required ? <span className="badge">required</span> : <span className="muted">optional</span>}</td>
                <td className="small">{c.format}{c.max_length ? `, max ${c.max_length}` : ''}</td>
                <td className="small muted">{c.example ?? '—'}</td>
                <td className="small">{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small mt-2">
        Rows are matched by <b>{info.match_on}</b>: a known {info.match_on} updates that user (blank cells keep the
        current value), an unknown one creates a new user. Headers are not case-sensitive; dates can be
        YYYY-MM-DD or DD-MM-YYYY.
      </p>
    </details>
  )
}
