import { useEffect, useState } from 'react'
import { lookupSchool } from '../services/auth.js'

/**
 * Looks a school code up (debounced) so sign-in forms can show the school's
 * name. state: idle | found | unknown | error (server unreachable, or too old
 * to know school codes: the sign-in itself then says what is wrong).
 */
export default function useSchoolName(orgCode) {
  const [school, setSchool] = useState({ state: 'idle' })
  useEffect(() => {
    const code = (orgCode || '').trim()
    if (code.length < 2) {
      setSchool({ state: 'idle' })
      return undefined
    }
    let alive = true
    const timer = setTimeout(async () => {
      try {
        const found = await lookupSchool(code)
        if (alive) setSchool({ state: 'found', name: found.name })
      } catch (err) {
        if (alive) setSchool({ state: err.status === 404 && err.detail === 'School not found' ? 'unknown' : 'error' })
      }
    }, 350)
    return () => { alive = false; clearTimeout(timer) }
  }, [orgCode])
  return school
}
