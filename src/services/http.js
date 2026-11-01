/**
 * The one place that talks to the backend.
 *
 * - adds the Bearer token, refreshes it when it expired (single-flight,
 *   shared across tabs) and retries the request once on 401
 * - turns error responses into ApiError with a readable message
 *   (string `detail`, FastAPI 422 lists, request ids on 500s, Retry-After)
 */
import { fmtWait } from '../lib/format.js'
import {
  clearSession,
  getAccessToken,
  getDeviceId,
  getRefreshToken,
  hasFreshAccessToken,
  requirePasswordChange,
  saveTokens,
} from './session.js'

export const API = (import.meta.env.VITE_API_URL || 'https://school-app-docker-v1.onrender.com')
  .replace(/\/+$/, '')

const PASSWORD_CHANGE_REQUIRED = 'Password change required'

export class ApiError extends Error {
  constructor({ status, message, detail, body, requestId, retryAfter }) {
    super(message)
    this.name = 'ApiError'
    this.status = status // 0 = network error
    this.detail = detail
    this.body = body // full JSON body (e.g. the import report on 422)
    this.requestId = requestId
    this.retryAfter = retryAfter // seconds, from Retry-After
  }
}

/* ------------------------------------------------------------ messages */

function validationMessage(items) {
  return items
    .map((d) => {
      const loc = (d.loc || []).filter((p) => p !== 'body' && p !== 'query' && typeof p === 'string')
      const field = loc.length ? loc[loc.length - 1].replace(/_/g, ' ') : ''
      const msg = String(d.msg || 'Invalid value').replace(/^Value error, /, '')
      return field ? `${field}: ${msg}` : msg
    })
    .join(' · ')
}

const FALLBACK = {
  400: 'The request was not accepted.',
  403: 'You are not allowed to do this.',
  404: 'Not found.',
  409: 'This conflicts with existing data.',
  413: 'The file is too large.',
  415: 'This file type is not supported.',
  429: 'Too many attempts.',
}

function errorFrom(res, body) {
  const requestId = body?.request_id || res.headers.get('X-Request-ID') || undefined
  const retryAfter = Number(res.headers.get('Retry-After')) || undefined
  const detail = body?.detail
  let message
  if (res.status >= 500) {
    message = `Something went wrong on the server${requestId ? ` (ref: ${requestId})` : ''}. Please try again.`
  } else if (typeof detail === 'string') {
    message = detail
  } else if (Array.isArray(detail)) {
    message = validationMessage(detail)
  } else {
    message = FALLBACK[res.status] || res.statusText || `Request failed (${res.status})`
  }
  if (res.status === 429 && retryAfter) message += ` Try again in ${fmtWait(retryAfter)}.`
  return new ApiError({ status: res.status, message, detail, body, requestId, retryAfter })
}

const networkError = () =>
  new ApiError({ status: 0, message: 'Cannot reach the server. Check your connection and try again.' })

/* ------------------------------------------------------------- refresh */

let refreshing = null

async function doRefresh() {
  const token = getRefreshToken()
  if (!token) return false
  let res
  try {
    res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token }),
    })
  } catch {
    return false // offline: keep the refresh token, try again later
  }
  if (res.status === 401) {
    // Another tab may have rotated the token while this request was in flight.
    if (getRefreshToken() !== token) return doRefresh()
    clearSession('expired')
    return false
  }
  if (!res.ok) return false // 5xx: not a logout
  saveTokens(await res.json())
  return true
}

/**
 * Get a new access token. Parallel callers share one request; with the Web
 * Locks API, tabs take turns so they don't race to rotate the same token.
 */
export function refreshSession({ rejected } = {}) {
  if (!refreshing) {
    // Inside the lock: if another caller already replaced the token we were
    // about to refresh (or that the server just rejected), use theirs.
    const run = () => {
      const token = getAccessToken()
      return token && token !== rejected && hasFreshAccessToken() ? true : doRefresh()
    }
    refreshing = (navigator.locks?.request ? navigator.locks.request('auth-refresh', run) : run())
      .catch(() => false)
      .finally(() => { refreshing = null })
  }
  return refreshing
}

/* ------------------------------------------------------------- request */

// Endpoints called without a session (they must never trigger a refresh or
// a sign-out: a 401 from /auth/login just means a wrong password).
const PUBLIC_PATHS = ['/auth/login', '/auth/captcha', '/auth/refresh', '/auth/logout', '/auth/forgot-password',
  '/auth/verify-reset-code', '/auth/reset-password']
const isPublic = (path) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}?`))

/**
 * Low-level request. Returns the Response for 2xx, throws ApiError otherwise.
 * opts: method, body (JSON), formData, headers, auth (default true), signal
 */
export async function request(path, { method = 'GET', body, formData, headers = {}, auth = true, signal } = {}) {
  const useAuth = auth && !isPublic(path)
  if (useAuth && !hasFreshAccessToken() && getRefreshToken()) await refreshSession()

  let sentToken = null
  const send = () => {
    const h = { 'X-Device-Id': getDeviceId(), ...headers }
    sentToken = getAccessToken()
    // /auth/logout accepts the access token when there is one
    if (sentToken && (useAuth || path === '/auth/logout')) h.Authorization = `Bearer ${sentToken}`
    if (body !== undefined && !formData) h['Content-Type'] = 'application/json'
    return fetch(API + path, {
      method,
      headers: h,
      body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    })
  }

  let res
  try {
    res = await send()
    if (res.status === 401 && useAuth) {
      if (await refreshSession({ rejected: sentToken })) res = await send()
    }
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw networkError()
  }

  if (res.ok) return res

  const data = await res.json().catch(() => null)
  if (res.status === 401 && useAuth) {
    clearSession('expired')
    throw new ApiError({ status: 401, message: 'Your session has expired. Please sign in again.', body: data })
  }
  if (res.status === 403 && data?.detail === PASSWORD_CHANGE_REQUIRED) requirePasswordChange()
  throw errorFrom(res, data)
}

const readJson = (res) => (res.status === 204 ? {} : res.json().catch(() => ({})))

/** JSON API call: returns the parsed body. */
export async function api(path, opts) {
  return readJson(await request(path, opts))
}

/**
 * Paginated list (`?limit=&offset=`): returns {rows, total}. `total` comes
 * from X-Total-Count.
 */
export async function apiPage(path, { limit, offset = 0, ...opts } = {}) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await request(`${path}${sep}limit=${limit}&offset=${offset}`, opts)
  const rows = await readJson(res)
  const total = Number(res.headers.get('X-Total-Count'))
  return { rows, total: Number.isFinite(total) ? total : rows.length }
}

/** Fetch a protected file: returns {blob, filename} (filename from Content-Disposition). */
export async function fetchFile(path, opts) {
  const res = await request(path, opts)
  return { blob: await res.blob(), filename: filenameFrom(res.headers.get('Content-Disposition')) }
}

function filenameFrom(header) {
  if (!header) return null
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header)
  if (star) {
    try { return decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')) } catch { /* fall through */ }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header)
  return plain ? plain[1].trim() : null
}

/**
 * When the tab becomes visible again after a while, refresh the token
 * before the user clicks anything. Returns an uninstall function.
 */
export function installResumeRefresh() {
  const onVisible = () => {
    if (document.visibilityState === 'visible' && getRefreshToken() && !hasFreshAccessToken(60_000)) {
      refreshSession()
    }
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}
