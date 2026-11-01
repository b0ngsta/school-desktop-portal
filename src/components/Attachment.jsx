/**
 * Files attached to records (homework sheets, notices, messages, timetables,
 * syllabus, announcement / event photos) — one picker and one viewer used by
 * every page.
 *
 *   <FileField file={file} onChange={setFile} />                  PDF or photo picker
 *   <AttachmentChip item={row} />                                 opens the viewer
 *   <FileViewer path={row.attachment_path} type="pdf" … />        modal viewer
 *
 * The API returns signed links (`uploads/…?exp=&sig=`) in `attachment_path` /
 * `image_path` / `media_path`; they expire after ~24h, so never store them.
 */
import React, { useEffect, useState } from 'react'
import { fetchPdfBlob, photoUrl } from '../api.js'
import { Field, Modal } from './ui.jsx'

export const FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const MAX_FILE_MB = 15

/** 'pdf' | 'image' from the API's attachment_type or the link's extension. */
export function fileKind(path, type) {
  if (type === 'pdf' || type === 'image') return type
  const clean = String(path || '').split('?')[0].toLowerCase()
  return clean.endsWith('.pdf') ? 'pdf' : 'image'
}

/** Client-side size check (the server enforces it too). Returns an error message or ''. */
export function fileProblem(file, maxMb = MAX_FILE_MB) {
  if (!file) return ''
  if (file.size > maxMb * 1024 * 1024) return `The file is larger than ${maxMb} MB.`
  return ''
}

/** File input for a PDF or a photo (optional unless `required`). */
export function FileField({ file, onChange, label = 'Attachment (PDF or photo, optional)', accept = FILE_ACCEPT,
  required = false, inputKey }) {
  return (
    <Field label={label}>
      <input key={inputKey} type="file" accept={accept} required={required}
        onChange={(e) => onChange(e.target.files[0] || null)} />
      {file && <div className="muted small mt-1">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</div>}
    </Field>
  )
}

/** Small pill showing the attachment; click opens the viewer. Renders nothing without a file. */
export function AttachmentChip({ path, name, type, label }) {
  const [open, setOpen] = useState(false)
  if (!path) return null
  const kind = fileKind(path, type)
  return (
    <>
      <button type="button" className="filelink" onClick={() => setOpen(true)}>
        {kind === 'pdf' ? '📄' : '🖼️'} {label || name || (kind === 'pdf' ? 'Open PDF' : 'Open photo')}
      </button>
      {open && <FileViewer path={path} type={kind} title={name || 'Attachment'} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Modal viewer: photos inline, PDFs fetched as a blob (the API forbids framing its own pages). */
export function FileViewer({ path, type, title, onClose }) {
  const kind = fileKind(path, type)
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (kind !== 'pdf') return undefined
    let blobUrl
    let alive = true
    fetchPdfBlob(`/${String(path).replace(/^\/+/, '')}`)
      .then((u) => { blobUrl = u; if (alive) setUrl(u); else URL.revokeObjectURL(u) })
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [path, kind])

  const footer = (
    <a className="filelink" href={kind === 'pdf' ? url || undefined : photoUrl(path)} target="_blank"
      rel="noreferrer" download={title}>
      Open in new tab
    </a>
  )
  return (
    <Modal title={title} onClose={onClose} xl footer={footer} error={error}>
      {kind === 'image' ? (
        <img src={photoUrl(path)} alt={title} className="mx-auto max-h-[70vh] rounded-lg object-contain" />
      ) : url ? (
        <iframe src={url} title={title} className="h-[70vh] w-full rounded-[10px] border border-line" />
      ) : !error ? (
        <div className="skeleton">Loading PDF…</div>
      ) : null}
    </Modal>
  )
}
