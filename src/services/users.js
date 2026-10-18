/** Staff account endpoints shared by several screens. */
import { api, apiPage } from './http.js'

/** Partial update of a staff account: only the given fields change. */
export const updateStaff = (userId, fields) => api(`/users/${userId}`, { method: 'PUT', body: fields })

/** The existing principal, or null (there can be only one). */
export async function findPrincipal() {
  const { rows } = await apiPage('/users?user_type=principal', { limit: 1 })
  return rows[0] || null
}

/** Upload a profile photo for any user id. */
export async function uploadUserPhoto(userId, file) {
  const fd = new FormData()
  fd.append('file', file)
  return api(`/users/${userId}/photo`, { method: 'POST', formData: fd })
}
