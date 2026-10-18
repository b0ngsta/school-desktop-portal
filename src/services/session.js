/**
 * Who is signed in, and their tokens.
 *
 * - access token: memory only (short-lived, sent as Bearer)
 * - refresh token + user profile: localStorage (survive reloads)
 *
 * Other modules subscribe to changes (sign-out, password change required,
 * profile updates) instead of reloading the page.
 */

const KEYS = { refresh: 'refresh_token', user: 'user', legacyToken: 'token' }

const store = {
  get(key) {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set(key, value) {
    try { localStorage.setItem(key, value) } catch { /* storage blocked: session lasts this tab */ }
  },
  remove(key) {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  },
}

let accessToken = null
let accessExpiresAt = 0 // ms epoch
const listeners = new Set()

// Sessions from before refresh tokens: keep using the old 24h token until it
// expires; the next 401 then sends the user to the login screen once.
const legacy = store.get(KEYS.legacyToken)
if (legacy && !store.get(KEYS.refresh)) {
  accessToken = legacy
  accessExpiresAt = Number.POSITIVE_INFINITY
}

function emit(event) {
  listeners.forEach((fn) => fn(event))
}

/** Listen for {type: 'user' | 'signed-out' | 'password-change-required'}. Returns unsubscribe. */
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getUser() {
  try { return JSON.parse(store.get(KEYS.user) || 'null') } catch { return null }
}

export function setUser(user) {
  store.set(KEYS.user, JSON.stringify(user))
  emit({ type: 'user', user })
}

/** Merge fields into the stored user (e.g. must_change_password: true). */
export function updateUser(patch) {
  const user = getUser()
  if (user) setUser({ ...user, ...patch })
}

export const getAccessToken = () => accessToken
export const getRefreshToken = () => store.get(KEYS.refresh)

/** True when the access token is present and not about to expire. */
export const hasFreshAccessToken = (skewMs = 30_000) =>
  Boolean(accessToken) && Date.now() < accessExpiresAt - skewMs

/** Store a TokenResponse (login / refresh / change- or reset-password). Returns the user. */
export function saveTokens(body) {
  accessToken = body.access_token
  accessExpiresAt = Date.now() + (Number(body.expires_in) || 900) * 1000
  store.set(KEYS.refresh, body.refresh_token)
  store.remove(KEYS.legacyToken)
  const previous = getUser()
  const user = {
    ...(previous?.id === body.user_id ? previous : {}),
    id: body.user_id,
    full_name: body.full_name,
    user_type: body.user_type,
    must_change_password: Boolean(body.must_change_password),
  }
  setUser(user)
  return user
}

/** Forget everything about the session. `reason`: 'logout' | 'expired'. */
export function clearSession(reason = 'logout') {
  const hadSession = Boolean(accessToken || getRefreshToken() || getUser())
  accessToken = null
  accessExpiresAt = 0
  Object.values(KEYS).forEach(store.remove)
  if (hadSession) emit({ type: 'signed-out', reason })
}

export function requirePasswordChange() {
  updateUser({ must_change_password: true })
  emit({ type: 'password-change-required' })
}

// Keep tabs in sync: signing out (or in as someone else) in one tab applies
// to the others. Their in-memory access token is dropped; the next request
// refreshes with the refresh token now in storage.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEYS.user) return
    const parse = (v) => { try { return JSON.parse(v || 'null') } catch { return null } }
    const before = parse(e.oldValue)
    const after = parse(e.newValue)
    if (before?.id !== after?.id) {
      accessToken = null
      accessExpiresAt = 0
    }
    if (!after) emit({ type: 'signed-out', reason: 'logout' })
    else emit({ type: 'user', user: after })
  })
}
