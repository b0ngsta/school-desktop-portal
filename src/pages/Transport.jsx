import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Empty, Field, Modal, StatCard, TimeInput } from '../components/ui.jsx'
import useMySections from '../hooks/useMySections.js'
import { fmtTime } from '../lib/format.js'

const EMPTY = {
  vehicle_no: '', vehicle_type: 'bus', driver_name: '', driver_phone: '', driver_id: '', route_name: '',
  capacity: '', status: 'active', shift_name: '', shift_start: '', shift_end: '',
}
const TYPES = { bus: 'Bus', van: 'Van', other: 'Other' }
const NULLABLE = ['driver_phone', 'route_name', 'shift_name', 'shift_start', 'shift_end']

const formOf = (v) => ({
  vehicle_no: v.vehicle_no, vehicle_type: v.vehicle_type || 'bus', driver_name: v.driver_name,
  driver_phone: v.driver_phone || '', driver_id: v.driver_id ? String(v.driver_id) : '',
  route_name: v.route_name || '', capacity: v.capacity || '', status: v.status,
  shift_name: v.shift_name || '', shift_start: v.shift_start || '', shift_end: v.shift_end || '',
})

export default function Transport({ user }) {
  const canEdit = user?.user_type !== 'driver'
  const [stats, setStats] = useState(null)
  const [items, setItems] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | {form, id?}
  const [riders, setRiders] = useState(null) // vehicle whose students are shown

  async function load() {
    try {
      setStats(await api('/vehicles/stats'))
      setItems(await api('/vehicles'))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
    if (canEdit) api('/users?user_type=driver').then(setDrivers).catch(() => {})
  }, [canEdit])

  async function submit(e) {
    e.preventDefault()
    try {
      const body = {
        ...editing.form,
        capacity: editing.form.capacity ? Number(editing.form.capacity) : null,
        driver_id: editing.form.driver_id ? Number(editing.form.driver_id) : null,
      }
      for (const k of NULLABLE) if (body[k] === '') body[k] = null
      if (editing.id) await api(`/vehicles/${editing.id}`, { method: 'PUT', body })
      else await api('/vehicles', { method: 'POST', body })
      setEditing(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this vehicle? Students on it lose their transport details.')) return
    try {
      await api(`/vehicles/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const setF = (k) => (e) => {
    const value = e.target.value
    setEditing((cur) => {
      const form = { ...cur.form, [k]: value }
      if (k === 'driver_id' && value) { // fill the name / phone from the driver's account
        const d = drivers.find((x) => String(x.id) === value)
        if (d) Object.assign(form, { driver_name: d.full_name, driver_phone: d.phone || form.driver_phone })
      }
      return { ...cur, form }
    })
  }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Transport</h2>
          <p>Vehicles, drivers, routes and the students on each vehicle (shown in the parent app).</p>
        </div>
        {canEdit && (
          <button className="fit" onClick={() => setEditing({ form: EMPTY })}>+ Add vehicle</button>
        )}
      </div>
      {error && <div className="error">{error}</div>}

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <StatCard icon="🚌" label="Total vehicles" value={stats?.total} />
        <StatCard icon="🟢" label="Active today" value={stats?.active} tone="green" />
        <StatCard icon="🗺️" label="Routes" value={stats?.routes} tone="blue" />
      </div>

      <div className="card">
        {!items ? (
          <div className="skeleton">Loading…</div>
        ) : items.length === 0 ? (
          <Empty icon="🚌" text="No vehicles yet." />
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Vehicle</th><th>Driver</th><th>Route</th><th>Shift</th>
                  <th>Students</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <b>{v.vehicle_no}</b>
                      <div className="muted small">{TYPES[v.vehicle_type] || 'Bus'}{v.capacity ? ` · ${v.capacity} seats` : ''}</div>
                    </td>
                    <td>
                      {v.driver_name}
                      <div className="muted small">{v.driver_phone || '—'}</div>
                    </td>
                    <td>{v.route_name || '—'}</td>
                    <td>
                      {v.shift_name || '—'}
                      {v.shift_start && <div className="muted small">{fmtTime(v.shift_start)} – {fmtTime(v.shift_end)}</div>}
                    </td>
                    <td>
                      <button className="soft sm" onClick={() => setRiders(v)}>{v.student_count || 0} students</button>
                    </td>
                    <td>
                      <span className={`badge ${v.status === 'active' ? 'green' : 'amber'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {canEdit && <><button className="ghost" style={{ padding: '5px 11px', marginRight: 6 }}
                        onClick={() => setEditing({ id: v.id, form: formOf(v) })}>
                        Edit
                      </button>
                      <button className="danger" onClick={() => remove(v.id)}>Delete</button></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal error={error} title={editing.id ? 'Edit vehicle' : 'Add vehicle'} onClose={() => setEditing(null)}>
          <form onSubmit={submit} className="grid">
            <div className="grid cols-2">
              <Field label="Vehicle number">
                <input value={editing.form.vehicle_no} onChange={setF('vehicle_no')}
                  placeholder="e.g. GJ01AB1234" required />
              </Field>
              <Field label="Type">
                <select value={editing.form.vehicle_type} onChange={setF('vehicle_type')}>
                  {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Driver account (for the photo in the app)">
                <select value={editing.form.driver_id} onChange={setF('driver_id')}>
                  <option value="">— None —</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name} ({d.username})</option>)}
                </select>
              </Field>
              <Field label="Driver name">
                <input value={editing.form.driver_name} onChange={setF('driver_name')} required />
              </Field>
              <Field label="Driver phone">
                <input value={editing.form.driver_phone} onChange={setF('driver_phone')} />
              </Field>
              <Field label="Route">
                <input value={editing.form.route_name} onChange={setF('route_name')}
                  placeholder="e.g. Route 1 — City Centre" />
              </Field>
              <Field label="Shift">
                <input value={editing.form.shift_name} onChange={setF('shift_name')} placeholder="e.g. Morning" />
              </Field>
              <div className="grid cols-2">
                <Field label="From"><TimeInput value={editing.form.shift_start} onChange={setF('shift_start')} /></Field>
                <Field label="To"><TimeInput value={editing.form.shift_end} onChange={setF('shift_end')} /></Field>
              </div>
              <Field label="Capacity">
                <input type="number" min="1" value={editing.form.capacity} onChange={setF('capacity')} />
              </Field>
              <Field label="Status">
                <select value={editing.form.status} onChange={setF('status')}>
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </Field>
            </div>
            <button>{editing.id ? 'Save changes' : 'Add vehicle'}</button>
          </form>
        </Modal>
      )}

      {riders && (
        <Riders vehicle={riders} user={user} canEdit={canEdit}
          onClose={() => { setRiders(null); load() }} />
      )}
    </>
  )
}

const NO_RIDER = { student_id: '', stop_name: '', pickup_time: '', drop_time: '' }

/** Students on one vehicle: their stop, pickup and drop time. */
function Riders({ vehicle, user, canEdit, onClose }) {
  const { classes } = useMySections(user)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [sectionKey, setSectionKey] = useState('')
  const [students, setStudents] = useState([])
  const [form, setForm] = useState(NO_RIDER)
  const [busy, setBusy] = useState(false)

  const load = () => api(`/vehicles/${vehicle.id}/students`).then(setRows).catch((e) => { setRows([]); setError(e.message) })
  useEffect(() => { load() }, [vehicle.id])

  useEffect(() => {
    if (!sectionKey) return setStudents([])
    const [classId, sectionId] = sectionKey.split(':')
    api(`/students?class_id=${classId}&section_id=${sectionId}`).then(setStudents).catch((e) => setError(e.message))
  }, [sectionKey])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/vehicles/${vehicle.id}/students/${form.student_id}`, {
        method: 'PUT',
        body: { stop_name: form.stop_name.trim() || null, pickup_time: form.pickup_time || null, drop_time: form.drop_time || null },
      })
      setForm(NO_RIDER)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(r) {
    if (!confirm(`Take ${r.full_name} off ${vehicle.vehicle_no}?`)) return
    try {
      await api(`/vehicles/${vehicle.id}/students/${r.student_id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const edit = (r) => {
    setSectionKey('')
    setStudents([{ id: r.student_id, full_name: r.full_name, roll_no: r.roll_no }])
    setForm({ student_id: String(r.student_id), stop_name: r.stop_name || '', pickup_time: r.pickup_time || '', drop_time: r.drop_time || '' })
  }

  return (
    <Modal title={`Students on ${vehicle.vehicle_no}`} onClose={onClose} wide error={error}>
      {canEdit && (
        <form onSubmit={save} className="card grid gap-3">
          <div className="grid cols-2">
            <Field label="Class / section">
              <select value={sectionKey} onChange={(e) => { setSectionKey(e.target.value); setForm({ ...form, student_id: '' }) }}>
                <option value="">Choose…</option>
                {(classes || []).flatMap((c) => c.sections.map((s) => (
                  <option key={s.id} value={`${c.id}:${s.id}`}>{c.name} — {s.name}</option>
                )))}
              </select>
            </Field>
            <Field label="Student">
              <select value={form.student_id} required onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                <option value="">Choose…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.roll_no ? `${s.roll_no}. ` : ''}{s.full_name}</option>)}
              </select>
            </Field>
            <Field label="Stop / pickup point">
              <input value={form.stop_name} onChange={(e) => setForm({ ...form, stop_name: e.target.value })} />
            </Field>
            <div className="grid cols-2">
              <Field label="Pickup"><TimeInput value={form.pickup_time} onChange={(e) => setForm({ ...form, pickup_time: e.target.value })} /></Field>
              <Field label="Drop"><TimeInput value={form.drop_time} onChange={(e) => setForm({ ...form, drop_time: e.target.value })} /></Field>
            </div>
          </div>
          <button className="fit" disabled={busy || !form.student_id}>{busy ? 'Saving…' : 'Save student'}</button>
        </form>
      )}
      {!rows ? (
        <div className="skeleton">Loading…</div>
      ) : rows.length === 0 ? (
        <Empty icon="🧑‍🎓" text="No students on this vehicle yet." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Stop</th><th>Pickup</th><th>Drop</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student_id}>
                  <td><b>{r.full_name}</b><div className="muted small">{[r.class_name, r.section_name].filter(Boolean).join(' — ')}</div></td>
                  <td>{r.stop_name || '—'}</td>
                  <td>{fmtTime(r.pickup_time) || '—'}</td>
                  <td>{fmtTime(r.drop_time) || '—'}</td>
                  <td className="actions">
                    {canEdit && <>
                      <button className="ghost sm" onClick={() => edit(r)}>Edit</button>
                      <button className="danger sm" onClick={() => remove(r)}>Remove</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
