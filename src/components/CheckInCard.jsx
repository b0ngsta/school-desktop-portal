import React, { useEffect, useState } from 'react'
import { api, fmtDate } from '../api.js'
import { fmtTime } from '../lib/format.js'
import { ErrorBox } from './ui.jsx'

/**
 * Today's staff attendance: in/out time (shown like "9:30 AM") and the
 * check-in / check-out button. `onChange` runs after a successful action.
 */
export default function CheckInCard({ compact = false, onChange }) {
  const [today, setToday] = useState(undefined) // undefined = loading, null = no record yet
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api('/staff-attendance/today').then((r) => setToday(r || null)).catch((e) => {
    setToday(null)
    setError(e.message)
  })
  useEffect(() => { load() }, [])

  async function act() {
    setBusy(true)
    setError('')
    try {
      await api(today?.in_time ? '/staff-attendance/check-out' : '/staff-attendance/check-in', { method: 'POST' })
      await load()
      onChange?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const done = !!(today?.in_time && today?.out_time)
  const label = !today?.in_time ? '✔ Check in' : !today?.out_time ? '✔ Check out' : '✅ Done for today'

  return (
    <div className={`hero ${compact ? '' : 'items-stretch'}`}>
      <div className="min-w-[160px] flex-1">
        <h3>Today’s attendance</h3>
        <div className="sub">{fmtDate(today?.date || new Date())}</div>
      </div>
      <div className="flex gap-2.5">
        {[['In time', today?.in_time], ['Out time', today?.out_time]].map(([k, v]) => (
          <div key={k} className="min-w-[96px] rounded-xl bg-white/15 px-3.5 py-2 text-center">
            <div className="text-[11.5px] opacity-80">{k}</div>
            <div className="text-[19px] font-extrabold">{today === undefined ? '…' : fmtTime(v)}</div>
          </div>
        ))}
      </div>
      <button onClick={act} disabled={busy || done || today === undefined}>
        {busy ? 'Saving…' : label}
      </button>
      {error && <ErrorBox error={error} className="mb-0 w-full" />}
    </div>
  )
}
