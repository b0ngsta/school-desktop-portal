import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPage } from '../api.js'

/**
 * Loads one page of a paginated endpoint (`?limit=&offset=`, X-Total-Count).
 * The offset resets to 0 whenever `path` changes (e.g. a new filter).
 *
 *   const list = usePagedList(`/users?user_type=${t}`, 50)
 *   list.rows, list.total, list.offset, list.setOffset, list.reload, list.error
 */
export default function usePagedList(path, limit = 50) {
  const [state, setState] = useState({ rows: null, total: 0, error: '' })
  const [offset, setOffset] = useState(0)
  const latest = useRef(0)

  const load = useCallback(async (at) => {
    const ticket = ++latest.current
    try {
      const { rows, total } = await apiPage(path, { limit, offset: at })
      if (ticket !== latest.current) return // a newer request superseded this one
      // the last page may have emptied (e.g. after a delete): step back one page
      if (rows.length === 0 && at > 0 && total > 0) {
        setOffset(Math.max(0, Math.floor((total - 1) / limit) * limit))
        return
      }
      setState({ rows, total, error: '' })
    } catch (e) {
      if (ticket === latest.current) setState((s) => ({ ...s, rows: s.rows || [], error: e.message }))
    }
  }, [path, limit])

  useEffect(() => { setOffset(0) }, [path])
  useEffect(() => { load(offset) }, [load, offset])

  return { ...state, limit, offset, setOffset, reload: () => load(offset) }
}
