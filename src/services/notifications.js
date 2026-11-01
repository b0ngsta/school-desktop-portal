/**
 * In-app notifications: unread count for the bell (polled every minute and
 * when the tab comes back), mark read, and where a notification should open.
 */
import { api } from './http.js'

let unread = 0
let supported = true
const listeners = new Set()

const emit = (n) => {
  if (n === unread) return
  unread = n
  listeners.forEach((fn) => fn(n))
}

export const getUnread = () => unread
export function onUnread(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export async function refreshUnread() {
  if (!supported) return
  try {
    const res = await api('/notifications/unread-count')
    emit(Math.max(0, Number(res?.count) || 0))
  } catch (e) {
    if ([404, 405].includes(e?.status)) supported = false
  }
}

/**
 * Start polling; returns stop(). A hidden tab doesn't poll (staff keep the app
 * open all day in a background tab); it catches up as soon as it is shown.
 */
export function startUnreadPolling(ms = 60_000) {
  supported = true
  refreshUnread()
  const timer = setInterval(() => document.visibilityState !== 'hidden' && refreshUnread(), ms)
  const onVisible = () => document.visibilityState === 'visible' && refreshUnread()
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
    emit(0)
  }
}

export async function markRead(n) {
  if (n.read_at) return
  await api(`/notifications/${n.id}/read`, { method: 'PUT' }).catch(() => {})
  refreshUnread()
}

export async function markAllRead() {
  await api('/notifications/read-all', { method: 'PUT' })
  emit(0)
}

/**
 * Web path for a notification. Uses data.web_path when the server sends it,
 * else maps the mobile route / type to the matching web page.
 */
const ROUTE_TO_PATH = {
  Substitutions: '/substitutions',
  Leaves: '/leaves',
  StaffNotices: '/notices',
  Notices: '/notices',
  FeesAdmin: '/fees',
  FeeClaims: '/fee-claims',
  MarkAttendance: '/attendance',
  ClassHomework: '/my-classes',
  Salary: '/salary',
  StaffAttendance: '/my-attendance',
}
const TYPE_TO_PATH = {
  substitution_request: '/substitutions',
  substitution_update: '/substitutions?tab=outgoing',
  leave: '/leaves',
  notice: '/notices',
  fee: '/fees',
  attendance: '/attendance',
  homework: '/my-classes',
}

export function pathFor(n) {
  const d = n?.data || {}
  if (d.web_path) return d.web_path
  if (d.route === 'Substitutions') {
    const q = new URLSearchParams()
    if (d.params?.tab) q.set('tab', d.params.tab)
    if (d.params?.id) q.set('id', d.params.id)
    return `/substitutions${q.toString() ? `?${q}` : ''}`
  }
  if (d.route === 'ClassHomework' && d.params?.classId) {
    return `/classes/${d.params.classId}/sections/${d.params.sectionId}?tab=homework`
  }
  return ROUTE_TO_PATH[d.route] || TYPE_TO_PATH[n?.type] || '/notifications'
}
