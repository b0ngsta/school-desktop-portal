/**
 * Public API surface used by the pages. The implementation lives in
 * src/services (http client, session, auth) and src/lib (helpers); this file
 * keeps the original import paths working.
 */
import { saveBlob } from './lib/format.js'
import { API, fetchFile } from './services/http.js'

export { API, ApiError, api, apiPage, fetchFile, request } from './services/http.js'
export { clearSession, getUser } from './services/session.js'
export { uploadUserPhoto } from './services/users.js'
export { MANAGERS } from './lib/roles.js'
export { fmtDate, fmtDateTime } from './lib/format.js'

/**
 * Public URL for an uploaded file path. The backend returns signed links
 * (`uploads/…?exp=…&sig=…`) that expire after ~24h: use them as-is and
 * never store them; re-fetch the data instead.
 */
export const photoUrl = (p) => {
  if (!p) return null
  if (/^(https?:|blob:|data:)/.test(p)) return p
  return `${API}/${String(p).replace(/^\/+/, '')}`
}

/** Fetch a protected PDF and return a blob URL (for inline viewing). Revoke it when done. */
export async function fetchPdfBlob(path) {
  const { blob } = await fetchFile(path)
  return URL.createObjectURL(blob)
}

/** Download a protected file (needs the Bearer header, so no plain <a href>). */
export async function downloadFile(path, filename) {
  const { blob, filename: serverName } = await fetchFile(path)
  saveBlob(blob, filename || serverName)
}
