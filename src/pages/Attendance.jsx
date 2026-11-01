import React, { useEffect, useState } from 'react'
import { MANAGERS, api } from '../api.js'
import { DateInput, Empty, StatCard } from '../components/ui.jsx'
import { localISODate as today } from '../lib/format.js'

export default function Attendance({ user }) {
  const isManager = MANAGERS.includes(user.user_type)
  const [stats, setStats] = useState(null)
  const [sections, setSections] = useState([]) // [{key, label, class_id, section_id, canMark}]
  const [sectionKey, setSectionKey] = useState('')
  const [date, setDate] = useState(today())
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api('/attendance/stats').then(setStats).catch(() => {})
    if (isManager) {
      api('/classes')
        .then((classes) =>
          setSections(
            classes.flatMap((c) =>
              c.sections.map((s) => ({
                key: `${c.id}:${s.id}`,
                label: `${c.name} — ${s.name}`,
                canMark: true,
              }))
            )
          )
        )
        .catch((e) => setError(e.message))
    } else {
      api('/assignments/mine')
        .then((a) => {
          const uniq = [...new Map(a.map((x) => [`${x.class_id}:${x.section_id}`, x])).values()]
          setSections(
            uniq.map((x) => ({
              key: `${x.class_id}:${x.section_id}`,
              label: `${x.class_name} — ${x.section_name}`,
              canMark: a.some(
                (y) =>
                  y.section_id === x.section_id && y.role === 'class_teacher'
              ),
            }))
          )
        })
        .catch((e) => setError(e.message))
    }
  }, [])

  const selected = sections.find((s) => s.key === sectionKey)

  async function loadSheet(key = sectionKey, d = date) {
    if (!key) return
    const [, sectionId] = key.split(':')
    setRows(null)
    setError('')
    try {
      const data = await api(`/attendance?section_id=${sectionId}&day=${d}`)
      setRows(data.map((r) => ({ ...r, status: r.status || 'present' })))
      setSaved(false)
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { loadSheet() }, [sectionKey, date])

  function setAll(status) {
    setRows(rows.map((r) => ({ ...r, status })))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const [, sectionId] = sectionKey.split(':')
      await api('/attendance', {
        method: 'POST',
        body: {
          section_id: Number(sectionId),
          date,
          records: rows.map((r) => ({ student_id: r.student_id, status: r.status })),
        },
      })
      setSaved(true)
      api('/attendance/stats').then(setStats).catch(() => {})
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const TONES = { present: 'green', absent: 'red', leave: 'amber' }

  return (
    <>
      <div className="page-head">
        <h2>Attendance</h2>
        <p>Pick a section and date, mark everyone, hit save.</p>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <StatCard icon="✅" label="Today's %" value={stats && `${stats.percentage}%`} tone="green" />
        <StatCard icon="🧑‍🎓" label="Present" value={stats?.present} />
        <StatCard icon="🚫" label="Absent" value={stats?.absent} tone="red" />
        <StatCard icon="🌴" label="On leave" value={stats?.on_leave} tone="amber" />
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <div>
            <label>Section</label>
            <select value={sectionKey} onChange={(e) => setSectionKey(e.target.value)}>
              <option value="">Select…</option>
              {sections.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Date</label>
            <DateInput value={date} max={today()}
              onChange={(e) => setDate(e.target.value)} />
          </div>
          {rows && selected?.canMark && (
            <div className="fit row" style={{ gap: 6 }}>
              <button type="button" className="ghost fit" onClick={() => setAll('present')}>All present</button>
              <button type="button" className="ghost fit" onClick={() => setAll('absent')}>All absent</button>
            </div>
          )}
        </div>

        {!sectionKey ? (
          <Empty icon="🗓️" text="Choose a section to open its attendance sheet." />
        ) : !rows ? (
          <div className="skeleton">Loading…</div>
        ) : rows.length === 0 ? (
          <Empty icon="🧑‍🎓" text="No students in this section." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Roll</th><th>Name</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.student_id}>
                      <td>{r.roll_no || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                      <td>
                        {selected?.canMark ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {['present', 'absent', 'leave'].map((st) => (
                              <button key={st} type="button"
                                className={r.status === st ? '' : 'ghost'}
                                style={{ padding: '5px 12px', fontSize: 12.5 }}
                                onClick={() => {
                                  const next = rows.slice()
                                  next[i] = { ...r, status: st }
                                  setRows(next)
                                }}>
                                {st}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className={`badge ${TONES[r.status] || 'gray'}`}>{r.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selected?.canMark && (
              <div className="row center" style={{ marginTop: 16 }}>
                <button className="fit" disabled={saving} onClick={save}>
                  {saving ? 'Saving…' : `Save attendance (${rows.length})`}
                </button>
                {saved && <span className="badge green fit">Saved ✓</span>}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
