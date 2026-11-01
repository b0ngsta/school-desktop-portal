import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { isManager } from '../lib/roles.js'

/**
 * The classes and sections the signed-in staff member works with:
 * managers → every class (with its subjects); teachers → the classes they are
 * assigned to, each section flagged `classTeacher` when they are its class teacher.
 *
 *   const { classes, error } = useMySections(user)
 *   classes: [{ id, name, subjects: [], sections: [{ id, name, classTeacher }] }] | null
 */
export default function useMySections(user) {
  const [state, setState] = useState({ classes: null, error: '' })
  const manager = isManager(user.user_type)

  useEffect(() => {
    let alive = true
    const load = manager ? loadAll() : loadAssigned()
    load
      .then((classes) => alive && setState({ classes, error: '' }))
      .catch((e) => alive && setState({ classes: [], error: e.message }))
    return () => { alive = false }
  }, [manager])

  return state
}

async function loadAll() {
  const classes = await api('/classes')
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    subjects: c.subjects || [],
    sections: (c.sections || []).map((s) => ({ id: s.id, name: s.name, classTeacher: true })),
  }))
}

async function loadAssigned() {
  const mine = await api('/assignments/mine')
  const byClass = new Map()
  for (const a of mine) {
    if (!byClass.has(a.class_id)) byClass.set(a.class_id, { id: a.class_id, name: a.class_name, subjects: [], sections: [] })
    const cls = byClass.get(a.class_id)
    let sec = cls.sections.find((s) => s.id === a.section_id)
    if (!sec) {
      sec = { id: a.section_id, name: a.section_name, classTeacher: false }
      cls.sections.push(sec)
    }
    if (a.role === 'class_teacher') sec.classTeacher = true
    if (a.subject && !cls.subjects.includes(a.subject)) cls.subjects.push(a.subject)
  }
  return [...byClass.values()]
}
