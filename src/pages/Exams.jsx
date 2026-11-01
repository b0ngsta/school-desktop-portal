import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MANAGERS, api, fmtDate } from '../api.js'
import { DateInput, Empty, Field, Modal, PdfModal, StatCard } from '../components/ui.jsx'

const TONES = { upcoming: 'blue', ongoing: 'amber', completed: 'green' }

export default function Exams({ user }) {
  const navigate = useNavigate()
  const isManager = MANAGERS.includes(user.user_type)
  const canPaper = ['admin', 'sub_admin'].includes(user.user_type)
  const [stats, setStats] = useState(null)
  const [items, setItems] = useState(null)
  const [classes, setClasses] = useState([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [viewingPaper, setViewingPaper] = useState(null) // exam
  const [uploadFor, setUploadFor] = useState(null) // exam id being uploaded
  const [form, setForm] = useState({ name: '', class_id: '', start_date: '', end_date: '' })
  const fileInput = useRef(null)

  async function load() {
    try {
      setStats(await api('/exams/stats'))
      setItems(await api('/exams'))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
    api('/classes').then(setClasses).catch(() => {})
  }, [])

  async function submit(e) {
    e.preventDefault()
    try {
      await api('/exams', {
        method: 'POST',
        body: { ...form, class_id: form.class_id === 'all' ? null : Number(form.class_id) },
      })
      setForm({ name: '', class_id: '', start_date: '', end_date: '' })
      setCreating(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function togglePublish(x) {
    try {
      await api(`/exams/${x.id}`, {
        method: 'PUT',
        body: { results_published: !x.results_published },
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this exam?')) return
    try {
      await api(`/exams/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function uploadPaper(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file || !uploadFor) return
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api(`/exams/${uploadFor}/paper`, { method: 'POST', formData: fd })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>Exams</h2>
          <p>Schedule exams, attach question papers, publish results.</p>
        </div>
        {isManager && <button className="fit" onClick={() => setCreating(true)}>+ Create exam</button>}
      </div>
      {error && <div className="error">{error}</div>}

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <StatCard icon="🗓️" label="Upcoming" value={stats?.upcoming} tone="blue" />
        <StatCard icon="✍️" label="Ongoing" value={stats?.ongoing} tone="amber" />
        <StatCard icon="✅" label="Completed" value={stats?.completed} tone="green" />
        <StatCard icon="📢" label="Results published" value={stats?.results_published} />
      </div>

      <div className="card">
        {!items ? (
          <div className="skeleton">Loading…</div>
        ) : items.length === 0 ? (
          <Empty icon="📝" text="No exams scheduled yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Exam</th><th>Class</th><th>Dates</th><th>Status</th>
                  <th>Question papers</th><th>Results</th>{isManager && <th />}
                </tr>
              </thead>
              <tbody>
                {items.map((x) => {
                  const resultsOpen = x.status === 'completed' || x.results_published
                  return (
                    <tr key={x.id}>
                      <td style={{ fontWeight: 600 }}>
                        <button className="filelink" style={{ fontWeight: 700 }}
                          onClick={() => navigate(`/exams/${x.id}`)}>
                          {x.name}
                        </button>
                      </td>
                      <td>{x.class_name || <span className="badge blue">All classes</span>}</td>
                      <td className="small">{fmtDate(x.start_date)} → {fmtDate(x.end_date)}</td>
                      <td><span className={`badge ${TONES[x.status]}`}>{x.status}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {x.paper_path && (
                          <button className="filelink" style={{ marginRight: 6 }}
                            onClick={() => setViewingPaper(x)}>
                            📄 Legacy paper
                          </button>
                        )}
                        <button className="soft" style={{ padding: '5px 11px' }}
                          onClick={() => navigate(`/exams/${x.id}`)}>
                          {Number(x.paper_count) > 0
                            ? `📄 ${x.paper_count} subject paper${x.paper_count > 1 ? 's' : ''}`
                            : canPaper ? 'Upload by subject' : 'View papers'}
                        </button>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {resultsOpen ? (
                          <button className="soft" style={{ padding: '5px 11px' }}
                            onClick={() => navigate(`/exams/${x.id}/results`)}>
                            View results
                          </button>
                        ) : (
                          <span className="badge gray">{x.status}</span>
                        )}
                      </td>
                      {isManager && (
                        <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                          <button className="ghost" style={{ padding: '5px 11px', marginRight: 6 }}
                            onClick={() => togglePublish(x)}>
                            {x.results_published ? 'Unpublish' : 'Publish results'}
                          </button>
                          <button className="danger" onClick={() => remove(x.id)}>Delete</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <input ref={fileInput} type="file" accept="application/pdf" hidden onChange={uploadPaper} />

      {viewingPaper && (
        <PdfModal
          path={`/exams/${viewingPaper.id}/paper`}
          title={`${viewingPaper.name} — Question paper`}
          onClose={() => setViewingPaper(null)}
        />
      )}

      {creating && (
        <Modal error={error} title="Create exam" onClose={() => setCreating(false)}>
          <form onSubmit={submit} className="grid">
            <Field label="Exam name">
              <input value={form.name} placeholder="e.g. Half Yearly Exam" required
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid cols-3">
              <Field label="Class">
                <select value={form.class_id} required
                  onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="all">🏫 All classes</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Start date">
                <DateInput value={form.start_date} required
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </Field>
              <Field label="End date">
                <DateInput value={form.end_date} required min={form.start_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </Field>
            </div>
            <button>Create exam</button>
          </form>
        </Modal>
      )}
    </>
  )
}
