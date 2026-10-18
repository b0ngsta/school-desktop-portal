import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import { isManager } from '../../lib/roles.js'

/**
 * Classes with the sections the actor may import students into:
 * managers → every section; teachers → only sections they are class teacher of.
 * Returns {classes: [{id, name, sections: [{id, name}]}] | null, error}.
 */
export default function useSectionOptions(actor, enabled) {
  const [state, setState] = useState({ classes: null, error: '' })

  useEffect(() => {
    if (!enabled || state.classes) return
    const load = isManager(actor.user_type) ? loadAll() : loadClassTeacherSections()
    load
      .then((classes) => setState({ classes, error: '' }))
      .catch((e) => setState({ classes: [], error: e.message }))
  }, [enabled, actor.user_type, state.classes])

  return state
}

async function loadAll() {
  const classes = await api('/classes')
  return classes.map((c) => ({ id: c.id, name: c.name, sections: c.sections || [] }))
}

async function loadClassTeacherSections() {
  const mine = await api('/assignments/mine')
  const byClass = new Map()
  for (const a of mine.filter((x) => x.role === 'class_teacher')) {
    if (!byClass.has(a.class_id)) byClass.set(a.class_id, { id: a.class_id, name: a.class_name, sections: [] })
    byClass.get(a.class_id).sections.push({ id: a.section_id, name: a.section_name })
  }
  return [...byClass.values()]
}
