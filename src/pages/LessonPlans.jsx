import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MANAGERS, api, downloadFile, fmtDate, fmtDateTime } from '../api.js'
import { Empty } from '../components/ui.jsx'

export default function LessonPlans({ user }) {
  const isManager = MANAGERS.includes(user.user_type)
  return isManager ? <AdminView user={user} /> : <TeacherView user={user} />
}

/* ---------- shared plan card ---------- */
function PlanCard({ plan, onDelete }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row center">
        <div style={{ flex: 1 }}>
          <strong>{plan.heading}</strong>
          <div className="muted small" style={{ marginTop: 3 }}>
            {plan.class_name}
            {plan.section_name ? ` — Section ${plan.section_name}` : ''} ·{' '}
            {plan.duration_start || plan.duration_end
              ? `${fmtDate(plan.duration_start)} → ${fmtDate(plan.duration_end)}`
              : fmtDateTime(plan.created_at)}
          </div>
        </div>
        {onDelete && (
          <button className="danger fit" onClick={() => onDelete(plan.id)}>Delete</button>
        )}
      </div>
      {plan.final_remark && <div style={{ marginTop: 8 }}>{plan.final_remark}</div>}
      {plan.files?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {plan.files.map((f) => (
            <button key={f.id} className="filelink"
              onClick={() => downloadFile(`/lessons/files/${f.id}`, f.original_name)}>
              {f.content_type === 'application/pdf' ? '📄' : '🖼️'} {f.original_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- teacher: own plans ---------- */
function TeacherView({ user }) {
  const [plans, setPlans] = useState(null)
  const [error, setError] = useState('')

  const load = () => api('/lessons').then(setPlans).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function remove(id) {
    if (!confirm('Delete this lesson plan?')) return
    try {
      await api(`/lessons/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-head row center">
        <div style={{ flex: 1 }}>
          <h2>My Lesson Plans</h2>
          <p>Everything you've submitted, class by class.</p>
        </div>
        <Link to="/lesson-plans/new" className="fit">
          <button>+ Add lesson plan</button>
        </Link>
      </div>
      {error && <div className="error">{error}</div>}
      {!plans ? (
        <div className="skeleton">Loading…</div>
      ) : plans.length === 0 ? (
        <div className="card"><Empty icon="📚" text="No lesson plans yet — add your first one." /></div>
      ) : (
        plans.map((p) => <PlanCard key={p.id} plan={p} onDelete={remove} />)
      )}
    </>
  )
}

/* ---------- managers: teacher list -> plans ---------- */
function AdminView({ user }) {
  const [teachers, setTeachers] = useState(null)
  const [selected, setSelected] = useState(null)
  const [plans, setPlans] = useState(null)
  const [error, setError] = useState('')
  const canDelete = user.user_type !== 'sub_admin'

  useEffect(() => {
    api('/users/teachers').then(setTeachers).catch((e) => setError(e.message))
  }, [])

  async function open(t) {
    setSelected(t)
    setPlans(null)
    try {
      setPlans(await api(`/lessons?teacher_id=${t.id}`))
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this lesson plan?')) return
    try {
      await api(`/lessons/${id}`, { method: 'DELETE' })
      open(selected)
    } catch (err) {
      setError(err.message)
    }
  }

  if (selected) {
    const byClass = {}
    for (const p of plans || []) {
      const key = `${p.class_name}${p.section_name ? ` — Section ${p.section_name}` : ''}`
      ;(byClass[key] = byClass[key] || []).push(p)
    }
    return (
      <>
        <button className="link" onClick={() => setSelected(null)}>← All teachers</button>
        <div className="page-head" style={{ marginTop: 8 }}>
          <h2>{selected.full_name}'s Lesson Plans</h2>
          <p>{selected.subject ? `${selected.subject} teacher` : 'Teacher'} · what's being taught, class by class. 👀</p>
        </div>
        {error && <div className="error">{error}</div>}
        {!plans ? (
          <div className="skeleton">Loading…</div>
        ) : plans.length === 0 ? (
          <div className="card"><Empty icon="📚" text="This teacher hasn't submitted any lesson plans yet." /></div>
        ) : (
          Object.entries(byClass).map(([cls, list]) => (
            <div key={cls} style={{ marginBottom: 22 }}>
              <h3 style={{ marginBottom: 10, fontSize: 15 }}>🏫 {cls}</h3>
              {list.map((p) => (
                <PlanCard key={p.id} plan={p} onDelete={canDelete ? remove : null} />
              ))}
            </div>
          ))
        )}
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <h2>Lesson Plans</h2>
        <p>Pick a teacher to see everything they're teaching.</p>
      </div>
      {error && <div className="error">{error}</div>}
      {!teachers ? (
        <div className="skeleton">Loading…</div>
      ) : teachers.length === 0 ? (
        <div className="card"><Empty icon="🧑‍🏫" text="No teachers yet — add them in Users." /></div>
      ) : (
        <div className="grid cards">
          {teachers.map((t) => (
            <div key={t.id} className="stat" style={{ cursor: 'pointer' }} onClick={() => open(t)}>
              <div className="avatar" style={{ width: 46, height: 46 }}>
                {t.full_name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div className="num" style={{ fontSize: 16 }}>{t.full_name}</div>
                <div className="lbl">{t.subject || 'Teacher'}</div>
              </div>
              <span className="badge">{t.lesson_plan_count} plans</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
