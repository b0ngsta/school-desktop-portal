import React, { useEffect, useState } from 'react'
import { MANAGERS, api, fmtDate } from '../api.js'
import CheckInCard from '../components/CheckInCard.jsx'
import { Avatar, Empty, ErrorBox } from '../components/ui.jsx'
import { roleLabel } from '../lib/roles.js'
import { fmtTime } from '../lib/format.js'

/** Hours between two times ("8h 05m"), or '—'. */
function worked(inT, outT) {
  const toMin = (s) => {
    const m = /(\d{1,2}):(\d{2})/.exec(String(s || '').replace(/^.*T/, ''))
    return m ? Number(m[1]) * 60 + Number(m[2]) : null
  }
  const a = toMin(inT)
  const b = toMin(outT)
  if (a == null || b == null || b < a) return '—'
  const d = b - a
  return `${Math.floor(d / 60)}h ${String(d % 60).padStart(2, '0')}m`
}

/** Staff attendance: check in/out, my history and (managers) who is in today. */
export default function StaffAttendance({ user }) {
  const isManager = MANAGERS.includes(user.user_type)
  const [tab, setTab] = useState('mine')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  const load = () => {
    setRows(null)
    api(tab === 'mine' ? '/staff-attendance/mine' : '/staff-attendance')
      .then((r) => { setRows(r || []); setError('') })
      .catch((e) => { setRows([]); setError(e.message) })
  }
  useEffect(load, [tab])

  return (
    <>
      <div className="page-head">
        <h2>My attendance</h2>
        <p>Check in when you arrive and check out when you leave.</p>
      </div>
      <CheckInCard onChange={load} />

      {isManager && (
        <div className="tabs">
          {[['mine', '📅 My history'], ['all', '👥 Staff today']].map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      )}
      <ErrorBox error={error} />

      <div className="card">
        {!rows ? (
          <div className="skeleton">Loading…</div>
        ) : rows.length === 0 ? (
          <Empty icon={tab === 'mine' ? '📅' : '👥'}
            text={tab === 'mine' ? 'No attendance records yet.' : 'Nobody has checked in yet today.'} />
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 420 }}>
              <thead>
                <tr>
                  <th>{tab === 'mine' ? 'Date' : 'Staff'}</th><th>In</th><th>Out</th><th>Worked</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {tab === 'mine' ? (
                        <b>{fmtDate(r.date)}</b>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.full_name} photo={r.photo_path} size={30} />
                          <div>
                            <b>{r.full_name}</b>
                            <div className="muted small">{roleLabel(r.user_type)}</div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td>{fmtTime(r.in_time)}</td>
                    <td>{fmtTime(r.out_time)}</td>
                    <td className="muted">{worked(r.in_time, r.out_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
