import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MANAGERS, api, fmtDateTime } from '../api.js'
import CheckInCard from '../components/CheckInCard.jsx'
import { Donut, Empty, StatCard, WeekLine } from '../components/ui.jsx'

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
const ICONS = {
  admission: '🧑‍🎓', payment: '💰', sms: '💬', lesson: '📚', enquiry: '🛎️', notice: '📣',
}

export default function Dashboard({ user }) {
  const [stats, setStats] = useState(null)
  const [week, setWeek] = useState(null)
  const [feeStats, setFeeStats] = useState(null)
  const [activities, setActivities] = useState(null)
  const [notices, setNotices] = useState([])
  const [error, setError] = useState('')

  const isManager = MANAGERS.includes(user.user_type)
  const isTeacher = user.user_type === 'teacher'

  useEffect(() => {
    api('/dashboard/stats').then(setStats).catch((e) => setError(e.message))
    api('/dashboard/attendance-week').then(setWeek).catch(() => {})
    if (isManager) {
      api('/fees/stats').then(setFeeStats).catch(() => {})
      api('/dashboard/activities').then(setActivities).catch(() => {})
    } else {
      api('/notices?limit=4').then((n) => setNotices(n.slice(0, 4))).catch(() => {})
    }
  }, [])

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const SL = ({ to, children }) => (
    <Link to={to} className="stat-link">{children}</Link>
  )

  return (
    <>
      <div className="page-head">
        <h2>{greet}, {user.full_name.split(' ')[0]}! 👋</h2>
        <p>Here's what's happening in your school today.</p>
      </div>
      {error && <div className="error">{error}</div>}
      <CheckInCard compact />

      <div className="grid cols-4" style={{ marginBottom: 20 }}>
        {isTeacher ? (
          <>
            <SL to="/my-classes"><StatCard icon="🏫" label="My classes" value={stats?.my_classes} /></SL>
            <SL to="/my-classes"><StatCard icon="🧑‍🎓" label="My students" value={stats?.my_students} tone="green" /></SL>
            <SL to="/lesson-plans"><StatCard icon="📚" label="My lesson plans" value={stats?.my_lesson_plans} tone="blue" /></SL>
            <SL to="/notices"><StatCard icon="📣" label="Notices" value={stats?.notices} tone="amber" /></SL>
          </>
        ) : (
          <>
            <SL to="/classes"><StatCard icon="🧑‍🎓" label="Students" value={stats?.students} /></SL>
            <SL to="/users"><StatCard icon="🧑‍🏫" label="Teachers" value={stats?.teachers} tone="green" /></SL>
            <SL to="/attendance">
              <StatCard icon="✅" label="Attendance today"
                value={stats && (stats.attendance_today != null ? `${stats.attendance_today}%` : '—')}
                tone="blue" />
            </SL>
            <SL to="/fees">
              <StatCard icon="💰" label="Fees collected"
                value={stats && inr(stats.fees_collected)} tone="amber" />
            </SL>
            <SL to="/classes">
              <StatCard icon="🏫" label="Classes / Sections"
                value={stats ? `${stats.classes} / ${stats.sections}` : undefined} />
            </SL>
            <SL to="/lesson-plans"><StatCard icon="📚" label="Lesson plans" value={stats?.lesson_plans} tone="green" /></SL>
            <SL to="/reception"><StatCard icon="🛎️" label="Enquiries today" value={stats?.enquiries_today} tone="red" /></SL>
            <SL to="/notices"><StatCard icon="📣" label="Notices" value={stats?.notices} tone="blue" /></SL>
          </>
        )}
      </div>

      <div className="grid cols-2">
        {/* attendance overview */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="row center" style={{ marginBottom: 6 }}>
            <h3 style={{ flex: 1, marginBottom: 0 }}>Attendance Overview</h3>
            <span className="chip">This week</span>
          </div>
          {!week ? (
            <div className="skeleton">Loading…</div>
          ) : week.every((p) => p.percentage == null) ? (
            <Empty icon="✅" text="No attendance marked yet this week." />
          ) : (
            <WeekLine points={week} />
          )}
        </div>

        {/* fees donut (managers) OR latest notices (teacher) */}
        {isManager ? (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="row center" style={{ marginBottom: 6 }}>
              <h3 style={{ flex: 1, marginBottom: 0 }}>Fees Collection</h3>
              <Link to="/fees"><button className="soft" style={{ padding: '5px 12px' }}>Open</button></Link>
            </div>
            {!feeStats ? (
              <div className="skeleton">Loading…</div>
            ) : feeStats.total === 0 ? (
              <Empty icon="💰" text="No fee records yet." />
            ) : (
              <div className="row center" style={{ gap: 18 }}>
                <Donut
                  center={inr(feeStats.collected)}
                  centerSub="collected"
                  segments={[
                    { value: feeStats.collected, color: 'var(--brand)', label: 'Paid' },
                    { value: feeStats.pending, color: '#f2b13c', label: 'Pending' },
                    { value: feeStats.overdue, color: 'var(--danger)', label: 'Overdue' },
                  ]}
                />
                <div className="legend" style={{ flex: 1, minWidth: 150 }}>
                  {[
                    ['Paid', feeStats.collected, 'var(--brand)'],
                    ['Pending', feeStats.pending, '#f2b13c'],
                    ['Overdue', feeStats.overdue, 'var(--danger)'],
                  ].map(([l, v, c]) => (
                    <div className="li" key={l}>
                      <span className="swatch" style={{ background: c }} />
                      {l}<span className="amt">{inr(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="row center" style={{ marginBottom: 8 }}>
              <h3 style={{ flex: 1, marginBottom: 0 }}>📣 Latest notices</h3>
              <Link to="/notices"><button className="soft" style={{ padding: '5px 12px' }}>View all</button></Link>
            </div>
            {notices.length === 0 ? (
              <Empty icon="📭" text="No notices yet." />
            ) : (
              notices.map((n) => (
                <div className="list-item" key={n.id}>
                  <strong>{n.title}</strong>
                  <div className="muted small">{n.posted_by} · {fmtDateTime(n.created_at)}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* recent activities */}
      {isManager && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>Recent Activities</h3>
          {!activities ? (
            <div className="skeleton">Loading…</div>
          ) : activities.length === 0 ? (
            <Empty icon="🕰️" text="Nothing has happened yet — go create something!" />
          ) : (
            activities.map((a, i) => (
              <div className="activity" key={i}>
                <div className="dot">{ICONS[a.type] || '•'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{a.text}</b>
                  <span className="sub">{a.sub}</span>
                </div>
                <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
                  {fmtDateTime(a.at)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </>
  )
}
