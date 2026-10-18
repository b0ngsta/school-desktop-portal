import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Empty, Field, Modal, StatCard } from '../components/ui.jsx'

const EMPTY = { vehicle_no: '', driver_name: '', driver_phone: '', route_name: '', capacity: '', status: 'active' }

export default function Transport({ user }) {
  const canEdit = user?.user_type !== 'driver'
  const [stats, setStats] = useState(null)
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | {form, id?}

  async function load() {
    try {
      setStats(await api('/vehicles/stats'))
      setItems(await api('/vehicles'))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  async function submit(e) {
    e.preventDefault()
    try {
      const body = { ...editing.form, capacity: editing.form.capacity ? Number(editing.form.capacity) : null }
      for (const k of ['driver_phone', 'route_name']) if (body[k] === '') body[k] = null
      if (editing.id) await api(`/vehicles/${editing.id}`, { method: 'PUT', body })
      else await api('/vehicles', { method: 'POST', body })
      setEditing(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this vehicle?')) return
    try {
      await api(`/vehicles/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const setF = (k) => (e) =>
    setEditing({ ...editing, form: { ...editing.form, [k]: e.target.value } })

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Transport</h2>
          <p>Vehicles, drivers and routes.</p>
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
            <table>
              <thead>
                <tr>
                  <th>Vehicle no</th><th>Driver</th><th>Phone</th><th>Route</th>
                  <th>Capacity</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 700 }}>{v.vehicle_no}</td>
                    <td>{v.driver_name}</td>
                    <td>{v.driver_phone || '—'}</td>
                    <td>{v.route_name || '—'}</td>
                    <td>{v.capacity || '—'}</td>
                    <td>
                      <span className={`badge ${v.status === 'active' ? 'green' : 'amber'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {canEdit && <><button className="ghost" style={{ padding: '5px 11px', marginRight: 6 }}
                        onClick={() => setEditing({
                          id: v.id,
                          form: {
                            vehicle_no: v.vehicle_no, driver_name: v.driver_name,
                            driver_phone: v.driver_phone || '', route_name: v.route_name || '',
                            capacity: v.capacity || '', status: v.status,
                          },
                        })}>
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
    </>
  )
}
