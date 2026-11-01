import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { timeAgo } from '../lib/format.js'
import { getUnread, markAllRead, markRead, onUnread, pathFor, startUnreadPolling } from '../services/notifications.js'
import { NOTIF_ICONS } from '../pages/Notifications.jsx'

/** Header bell with unread count and a dropdown of the latest notifications. */
export default function NotificationBell() {
  const [count, setCount] = useState(getUnread)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(null)
  const box = useRef(null)
  const navigate = useNavigate()

  useEffect(() => startUnreadPolling(), [])
  useEffect(() => onUnread(setCount), [])
  useEffect(() => {
    if (!open) return undefined
    api('/notifications?limit=8').then((r) => setItems(r || [])).catch(() => setItems([]))
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  async function go(n) {
    setOpen(false)
    await markRead(n)
    navigate(pathFor(n))
  }

  return (
    <div className="relative" ref={box}>
      <button className="bell-btn" onClick={() => setOpen((o) => !o)}
        aria-label={count ? `${count} unread notifications` : 'Notifications'} aria-expanded={open}>
        🔔
        {count > 0 && <span className="bell-count">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-[46px] z-40 w-[min(360px,calc(100vw-32px))] animate-pop rounded-card border border-line bg-white p-2 shadow-pop">
          <div className="split px-2 py-1.5">
            <b>Notifications</b>
            {count > 0 && (
              <button className="link text-[12.5px] no-underline" onClick={async () => {
                await markAllRead().catch(() => {})
                setItems((xs) => xs?.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })))
              }}>Mark all read</button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {!items ? (
              <div className="skeleton">Loading…</div>
            ) : items.length === 0 ? (
              <div className="empty py-6">You're all caught up.</div>
            ) : items.map((n) => (
              <button key={n.id} onClick={() => go(n)}
                className={`flex w-full items-start gap-2.5 rounded-[10px] bg-transparent px-2 py-2 text-left font-normal text-ink hover:bg-page ${n.read_at ? '' : 'bg-brand-soft/50'}`}>
                <span className="mt-0.5">{NOTIF_ICONS[n.type] || '🔔'}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13.5px] ${n.read_at ? 'font-semibold' : 'font-bold'}`}>{n.title}</span>
                  {n.body && <span className="block truncate text-[12px] text-subtle">{n.body}</span>}
                  <span className="text-[11px] text-subtle">{timeAgo(n.created_at)}</span>
                </span>
                {!n.read_at && <span className="notif-dot mt-1.5" />}
              </button>
            ))}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)}
            className="mt-1 block rounded-[10px] px-2 py-2 text-center text-[13px] font-semibold text-brand hover:bg-page">
            View all
          </Link>
        </div>
      )}
    </div>
  )
}
