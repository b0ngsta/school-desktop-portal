/**
 * Sign-in, sign-out and password endpoints (see backend docs/AUTH.md).
 *
 * One server hosts many schools: sign-in and password reset name the school
 * by its code (`org_code`, case-insensitive). Usernames are only unique
 * inside a school.
 */
import { api } from './http.js'
import { clearSession, getRefreshToken, saveTokens, updateUser } from './session.js'

const withOrg = (orgCode, body) => {
  const code = (orgCode || '').trim()
  return code ? { org_code: code, ...body } : body
}

/**
 * Returns the signed-in user ({id, full_name, user_type, must_change_password, org}).
 * After a few failed tries the server answers 428 with `code: 'captcha_required'`
 * (or 'captcha_invalid'): show getCaptcha()'s picture and pass `captcha`
 * ({id, answer}) with the next try.
 */
export async function login(username, password, orgCode, captcha = null) {
  return saveTokens(await api('/auth/login', {
    method: 'POST',
    body: withOrg(orgCode, {
      username: username.trim(),
      password,
      captcha_supported: true,
      ...(captcha ? { captcha_id: captcha.id, captcha_answer: captcha.answer.trim() } : {}),
    }),
  }))
}

/** True when a sign-in error asks for the picture challenge. */
export const needsCaptcha = (err) =>
  err?.status === 428 && ['captcha_required', 'captcha_invalid'].includes(err?.body?.code)

/** A one-time picture for the next sign-in: {captcha_id, image (data URL), expires_in, length}. */
export async function getCaptcha() {
  return api('/auth/captcha', { method: 'POST', auth: false })
}

/** The school's display name for a code: {code, name}. 404 = unknown code. */
export async function lookupSchool(orgCode) {
  return api(`/organisations/${encodeURIComponent(orgCode.trim())}`, { auth: false })
}

/** End this device's session. Never throws: the local session is cleared regardless. */
export async function logout() {
  const refresh_token = getRefreshToken()
  try {
    await api('/auth/logout', { method: 'POST', body: refresh_token ? { refresh_token } : {} })
  } catch { /* offline or already expired: nothing to revoke */ }
  clearSession('logout')
}

/** Sign out every device of the current user (including this one). */
export async function logoutAll() {
  await api('/auth/logout-all', { method: 'POST' })
  clearSession('logout')
}

/** Other devices are signed out; this one gets fresh tokens. */
export async function changePassword(currentPassword, newPassword) {
  const user = saveTokens(await api('/auth/change-password', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  }))
  updateUser({ must_change_password: false })
  return { ...user, must_change_password: false }
}

/* ------------------------------------------------------ forgot password */

/** Always succeeds for a known school (same reply whether or not the account exists). */
export async function requestResetCode(login, orgCode) {
  return api('/auth/forgot-password', { method: 'POST', body: withOrg(orgCode, { login: login.trim() }) })
}

export async function verifyResetCode(login, code, orgCode) {
  return api('/auth/verify-reset-code', {
    method: 'POST',
    body: withOrg(orgCode, { login: login.trim(), code: code.trim() }),
  })
}

/** Sets the new password and signs this device in. Returns the user. */
export async function resetPassword(login, code, newPassword, orgCode) {
  return saveTokens(await api('/auth/reset-password', {
    method: 'POST',
    body: withOrg(orgCode, { login: login.trim(), code: code.trim(), new_password: newPassword }),
  }))
}
