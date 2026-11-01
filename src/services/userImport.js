/** Bulk user import from an Excel sheet (.xlsx; CSV also accepted) — see backend FRONTEND_README §5. */
import { saveBlob } from '../lib/format.js'
import { ApiError, api, fetchFile } from './http.js'

const query = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

/** Column help: {user_type, needs_section, max_rows, max_csv_mb, max_zip_mb, photo_max_mb, columns[]} */
export const getImportColumns = (userType) => api(`/imports/users/columns?${query({ user_type: userType })}`)

export async function downloadImportTemplate(userType) {
  const { blob, filename } = await fetchFile(`/imports/users/template?${query({ user_type: userType })}`)
  saveBlob(blob, filename || `${userType}_import_template.xlsx`)
}

export async function downloadUsersExport(userType, classId, sectionId) {
  const { blob, filename } = await fetchFile(
    `/imports/users/export?${query({ user_type: userType, class_id: classId, section_id: sectionId })}`
  )
  saveBlob(blob, filename || `${userType}s_export.xlsx`)
}

/**
 * Preview (save=false) or save (save=true) an import.
 * Resolves to the report. When nothing could be saved (422 with a report),
 * resolves to that report with `rejected: <message>` instead of throwing, so
 * the preview table can be shown again. Other errors throw ApiError.
 */
export async function runImport({ userType, classId, sectionId, csv, photos, save }) {
  const form = new FormData()
  form.append('user_type', userType)
  if (classId) form.append('class_id', String(classId))
  if (sectionId) form.append('section_id', String(sectionId))
  form.append('dry_run', save ? 'false' : 'true')
  form.append('file', csv)
  if (photos) form.append('photos', photos)
  try {
    return await api('/imports/users', { method: 'POST', formData: form })
  } catch (err) {
    if (err instanceof ApiError && err.status === 422 && Array.isArray(err.body?.rows)) {
      return { ...err.body, rejected: err.message }
    }
    throw err
  }
}
