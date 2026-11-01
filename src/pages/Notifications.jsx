import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Empty, ErrorBox, Pager } from '../components/ui.jsx'
import usePagedList from '../hooks/usePagedList.js'
import { timeAgo } from '../lib/format.js'
import { markAllRead, markRead, pathFor } from '../services/notifications.js'

export const NOTIF_ICONS = {
  attendance: '✅', fee: '💰', notice: '📣', homework: '📚', leave: '🧳',
  substitution_request: '🔁', substitution_update: '🔁',
}

/** All notifications; click one to open what it is about. */
export default function Notifications() {
  const list = usePagedList('/notifications', 30)
  const navigate = useNavigate()

  async function open(n) {
    await markRead(n)
    navigate(pathFor(n))
  }

  const hasUnread = list.rows?.some((n) => !n.read_at)
  return (
    <>
      <div className="page-head split">
        <div>
          <h2>Notifications</h2>
          <p>Substitute requests, leave updates, notices and more.</p>
        </div>
        {hasUnread && (
          <button className="soft" onClick={async () => { await markAllRead().catch(() => {}); list.reload() }}>
            Mark all read
          </button>
        )}
      </div>
      <ErrorBox error={list.error} />
      <div className="card">
        {!list.rows ? (
          <div className="skeleton">Loading…</div>
        ) : list.rows.length === 0 ? (
          <Empty icon="🔔" text="No notifications yet." />
        ) : (
          list.rows.map((n) => (
            <button key={n.id} onClick={() => open(n)}
              className={`activity w-full rounded-none bg-transparent px-1 text-left font-normal text-ink hover:bg-page ${n.read_at ? '' : 'bg-brand-soft/40'}`}>
              <div className="dot">{NOTIF_ICONS[n.type] || '🔔'}</div>
              <div className="min-w-0 flex-1">
                <b className={n.read_at ? 'font-semibold' : ''}>{n.title}</b>
                {n.body && <span className="sub">{n.body}</span>}
              </div>
              <span className="muted small whitespace-nowrap">{timeAgo(n.created_at)}</span>
              {!n.read_at && <span className="notif-dot mt-1.5" />}
            </button>
          ))
        )}
        <Pager offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
      </div>
    </>
  )
}
