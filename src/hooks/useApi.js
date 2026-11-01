import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

/** True when the server has no such endpoint yet (older backend). */
export const isMissingEndpoint = (e) => [404, 405, 501].includes(e?.status)

/**
 * GET a JSON endpoint. Pass null to skip.
 *   const { data, error, missing, reload, setData } = useApi('/settings/school-timings')
 * `missing` is true when the endpoint doesn't exist on this server yet.
 */
export default function useApi(path) {
  const [state, setState] = useState({ data: null, error: '', missing: false, loading: !!path })
  const latest = useRef(0)

  const load = useCallback(async () => {
    if (!path) return
    const ticket = ++latest.current
    setState((s) => ({ ...s, loading: true }))
    try {
      const data = await api(path)
      if (ticket === latest.current) setState({ data, error: '', missing: false, loading: false })
    } catch (e) {
      if (ticket === latest.current) {
        setState((s) => ({ ...s, error: isMissingEndpoint(e) ? '' : e.message, missing: isMissingEndpoint(e), loading: false }))
      }
    }
  }, [path])

  useEffect(() => { load() }, [load])

  const setData = (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn }))
  return { ...state, reload: load, setData }
}

/** The school's bell schedule, or null when not set / not supported. */
export function useSchoolTimings() {
  const res = useApi('/settings/school-timings')
  return res.data?.start_time ? res.data : null
}
