import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorBox, Field, StatCard } from '../components/ui.jsx'
import { plural, saveBlob, toCsv } from '../lib/format.js'
import { importableTypes, isManager, roleLabel } from '../lib/roles.js'
import {
  downloadImportTemplate, downloadUsersExport, getImportColumns, runImport,
} from '../services/userImport.js'
import { findPrincipal } from '../services/users.js'
import ColumnHelp from './user-import/ColumnHelp.jsx'
import ImportTips from './user-import/ImportTips.jsx'
import ReportTable from './user-import/ReportTable.jsx'
import useSectionOptions from './user-import/useSectionOptions.js'

const OLD_EXCEL_RE = /\.(xls|ods|numbers)$/i
const MB = 1024 * 1024

/**
 * Add or edit users from an Excel sheet (.xlsx; CSV still accepted):
 * choose type (+ section for students) → template/export → upload the sheet (+ photos ZIP)
 * → preview → save the good rows → fix the skipped rows and upload again.
 */
export default function UserImport({ user }) {
  const [params, setParams] = useSearchParams()
  const types = importableTypes(user.user_type)
  const userType = types.includes(params.get('user_type')) ? params.get('user_type') : ''
  const classId = params.get('class_id') || ''
  const sectionId = params.get('section_id') || ''
  const needsSection = userType === 'student'
  const target = { userType, classId, sectionId }
  const ready = Boolean(userType && (!needsSection || (classId && sectionId)))

  // Selection lives in the URL so it survives reloads and can be linked to.
  const select = (patch) => {
    const next = { user_type: userType, class_id: classId, section_id: sectionId, ...patch }
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)), { replace: true })
  }

  const sections = useSectionOptions(user, needsSection)
  const [info, setInfo] = useState(null)
  const [principal, setPrincipal] = useState(undefined)
  const [csv, setCsv] = useState(null)
  const [photos, setPhotos] = useState(null)
  const [report, setReport] = useState(null) // last preview / save report
  const [phase, setPhase] = useState('upload') // upload | preview | result
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [inputsKey, setInputsKey] = useState(0) // bump to clear the file inputs

  // a new type or section starts over
  useEffect(() => startOver(), [userType, classId, sectionId])

  useEffect(() => {
    setInfo(null)
    if (!userType) return
    getImportColumns(userType).then(setInfo).catch((e) => setError(e.message))
  }, [userType])

  useEffect(() => {
    if (userType === 'principal' && principal === undefined) {
      findPrincipal().then(setPrincipal).catch(() => setPrincipal(null))
    }
  }, [userType, principal])

  const currentClass = sections.classes?.find((c) => String(c.id) === classId)
  const backTo = needsSection && classId && sectionId
    ? `/classes/${classId}/sections/${sectionId}`
    : isManager(user.user_type) ? '/users' : '/my-classes'

  function pickFile(setter, kind) {
    return (e) => {
      const file = e.target.files[0] || null
      setError('')
      if (file && info) {
        const problem = kind === 'csv' ? csvProblem(file, info) : zipProblem(file, info)
        if (problem) {
          e.target.value = ''
          setError(problem)
          setter(null)
          return
        }
      }
      setter(file)
      // the preview belongs to the old file
      setReport(null)
      setPhase('upload')
    }
  }

  async function submit(save) {
    setBusy(save ? 'save' : 'preview')
    setError('')
    try {
      const res = await runImport({ ...target, csv, photos, save })
      setReport(res)
      if (res.rejected) {
        setError(res.rejected)
        setPhase('preview')
      } else {
        setPhase(save ? 'result' : 'preview')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  function startOver() {
    setReport(null)
    setCsv(null)
    setPhotos(null)
    setPhase('upload')
    setError('')
    setInputsKey((k) => k + 1)
  }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <Link className="text-link" to={backTo}>← Back</Link>
          <h2 style={{ marginTop: 6 }}>Import users from Excel</h2>
          <p>Add new users or update existing ones from a spreadsheet. Rows with problems are skipped; the rest are saved.</p>
        </div>
      </div>

      {/* 1. what to import */}
      <div className="card">
        <h3>1. What are you importing?</h3>
        <div className="grid cols-3">
          <Field label="Account type">
            <select value={userType} onChange={(e) => select({ user_type: e.target.value, class_id: '', section_id: '' })}>
              <option value="">Choose…</option>
              {types.map((t) => <option key={t} value={t}>{roleLabel(t)}</option>)}
            </select>
          </Field>
          {needsSection && (
            <>
              <Field label="Class">
                <select value={classId} onChange={(e) => select({ class_id: e.target.value, section_id: '' })}>
                  <option value="">{sections.classes ? 'Choose…' : 'Loading…'}</option>
                  {sections.classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Section">
                <select value={sectionId} onChange={(e) => select({ section_id: e.target.value })} disabled={!currentClass}>
                  <option value="">Choose…</option>
                  {currentClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </>
          )}
        </div>
        <ErrorBox error={sections.error} className="mt-3 mb-0" />
        {needsSection && sections.classes?.length === 0 && !sections.error && (
          <p className="muted small mt-3">
            {user.user_type === 'teacher'
              ? 'You can import students only into the section you are class teacher of, and you have none yet.'
              : 'No classes yet. Add a class and section first.'}
          </p>
        )}
        {userType === 'principal' && principal && (
          <p className="notice mt-3">
            There is already a principal ({principal.username}). This file can only update that account.
          </p>
        )}
      </div>

      {ready && info && (
        <>
          {/* 2. get the file */}
          <div className="card">
            <h3>2. Get the spreadsheet</h3>
            <p className="muted mb-3">
              New users: start from the empty template. Editing users: export them, change the cells, upload the file again.
            </p>
            <div className="btn-row mb-3">
              <DownloadButton label="⬇️ Empty template" run={() => downloadImportTemplate(userType)} onError={setError} />
              <DownloadButton label="⬇️ Export current users" run={() => downloadUsersExport(userType, classId, sectionId)}
                onError={setError} />
            </div>
            <ColumnHelp info={info} />
            <ImportTips withPhotos={info.columns.some((c) => c.name === 'photo')} />
          </div>

          {/* 3. upload */}
          <div className="card">
            <h3>3. Upload and preview</h3>
            <div className="grid cols-2">
              <Field label={`Excel file (.xlsx, max ${info.max_csv_mb} MB, ${info.max_rows} rows)`}>
                <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={pickFile(setCsv, 'csv')} key={`csv-${inputsKey}`} />
              </Field>
              <Field label={`Photos ZIP — optional (max ${info.max_zip_mb} MB)`}>
                <input type="file" accept=".zip,application/zip" onChange={pickFile(setPhotos, 'zip')}
                  key={`zip-${inputsKey}`} />
              </Field>
            </div>
            <ErrorBox error={error} className="mt-3 mb-0" />
            <div className="btn-row mt-3">
              <button disabled={!csv || Boolean(busy)} onClick={() => submit(false)}>
                {busy === 'preview' ? 'Checking…' : report ? 'Preview again' : 'Preview'}
              </button>
            </div>
          </div>

          {report && phase === 'preview' && (
            <PreviewCard report={report} busy={busy} onSave={() => submit(true)} />
          )}
          {report && phase === 'result' && (
            <ResultCard report={report} backTo={backTo} onUploadAgain={startOver} />
          )}
        </>
      )}
      {ready && !info && (error ? <ErrorBox error={error} /> : <div className="skeleton">Loading columns…</div>)}
    </>
  )
}

function PreviewCard({ report, busy, onSave }) {
  const s = report.summary
  const savable = s.create + s.update
  return (
    <div className="card">
      <h3>4. Check the preview{report.class_name ? ` — ${report.class_name} ${report.section_name}` : ''}</h3>
      <Summary summary={s} />
      <Warnings list={report.warnings} />
      <ReportTable key={`${s.rows}-${s.error}`} report={report} initialFilter={s.error ? 'error' : 'all'} />
      <div className="btn-row mt-3">
        <button disabled={savable === 0 || Boolean(busy)} onClick={onSave}>
          {busy === 'save'
            ? 'Saving…'
            : savable === 0
              ? 'Nothing to save'
              : `Save ${plural(savable, 'user')}${s.error ? ` (${plural(s.error, 'row')} will be skipped)` : ''}`}
        </button>
        {savable === 0 && s.error > 0 && (
          <span className="muted small">Fix the rows marked Error in your file, then preview again.</span>
        )}
      </div>
    </div>
  )
}

function ResultCard({ report, backTo, onUploadAgain }) {
  const s = report.summary
  const skipped = report.rows.filter((r) => r.action === 'error')
  const savedCount = s.create + s.update

  function downloadErrors() {
    const rows = [['row', 'username', 'full_name', 'errors'],
      ...skipped.map((r) => [r.row, r.username, r.full_name, r.errors.join('; ')])]
    saveBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `import_errors_${report.user_type}.csv`)
  }

  return (
    <div className="card">
      <h3>Done</h3>
      <div className={`notice ${skipped.length ? 'warn' : 'ok'} mb-3.5`}>
        <b>{plural(savedCount, 'user')} saved</b>
        {savedCount > 0 ? ` (${s.create} new, ${s.update} updated)` : ''}
        {skipped.length ? `, ${plural(skipped.length, 'row')} skipped.` : '.'}
        {s.create > 0 && ' New users will be asked to change their password when they first sign in.'}
      </div>
      <Warnings list={report.warnings} />
      {skipped.length > 0 && (
        <>
          <p className="mb-3">Fix these rows in your file and upload it again — rows already saved show as “unchanged”, so nothing is created twice.</p>
          <ReportTable report={report} saved initialFilter="error" />
        </>
      )}
      <div className="btn-row mt-3">
        {skipped.length > 0 && <button className="soft" onClick={downloadErrors}>⬇️ Download error report</button>}
        <button className={skipped.length ? '' : 'ghost'} onClick={onUploadAgain}>Upload another file</button>
        <Link to={backTo}><button className="ghost">Finish</button></Link>
      </div>
    </div>
  )
}

function Summary({ summary }) {
  return (
    <div className="grid cols-4 mb-3.5">
      <StatCard icon="➕" label="New" value={summary.create} tone="green" />
      <StatCard icon="✏️" label="Updated" value={summary.update} tone="blue" />
      <StatCard icon="＝" label="Unchanged" value={summary.unchanged} />
      <StatCard icon="⚠️" label="Errors (skipped)" value={summary.error} tone="red" />
    </div>
  )
}

function Warnings({ list }) {
  if (!list?.length) return null
  return (
    <div className="notice warn mb-3.5">
      <ul className="msg-list">{list.map((w, i) => <li key={i}>{w}</li>)}</ul>
    </div>
  )
}

function DownloadButton({ label, run, onError }) {
  const [busy, setBusy] = useState(false)
  return (
    <button className="ghost" disabled={busy} onClick={async () => {
      setBusy(true)
      onError('')
      try { await run() } catch (e) { onError(e.message) } finally { setBusy(false) }
    }}>
      {busy ? 'Preparing…' : label}
    </button>
  )
}

function csvProblem(file, info) {
  if (OLD_EXCEL_RE.test(file.name)) return 'Save it as an Excel Workbook (.xlsx) and upload that.'
  if (!/\.(xlsx|csv|txt)$/i.test(file.name)) return 'Choose the Excel (.xlsx) file.'
  if (file.size > info.max_csv_mb * MB) return `The file is larger than ${info.max_csv_mb} MB. Split it into smaller files.`
  if (file.size === 0) return 'The file is empty.'
  return ''
}

function zipProblem(file, info) {
  if (!/\.zip$/i.test(file.name)) return 'Photos must be in a .zip file.'
  if (file.size > info.max_zip_mb * MB) return `The ZIP is larger than ${info.max_zip_mb} MB.`
  return ''
}
