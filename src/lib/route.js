import { useCallback, useEffect, useState } from 'react'

// #/my[/requested][?t=taskId]
// #/inbox[?t=taskId]
// #/project/<id>/<list|board|calendar>[?t=taskId]
// #/task/<id>            ← メールのリンク
function parse() {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [path, qs] = h.split('?')
  const parts = path.split('/').filter(Boolean)
  const q = new URLSearchParams(qs || '')
  return {
    view: parts[0] || 'my',
    id: parts[1] || null,
    tab: parts[2] || 'list',
    task: q.get('t'),
  }
}

function build(r) {
  let p = '#/' + r.view
  if (r.id) p += '/' + r.id
  if (r.view === 'project') p += '/' + (r.tab || 'list')
  if (r.task) p += '?t=' + r.task
  return p
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const f = () => setRoute(parse())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const go = useCallback((patch, replace = false) => {
    const next = build({ ...parse(), ...patch })
    if (replace) {
      window.history.replaceState(null, '', next)
      setRoute(parse())
    } else if (next !== window.location.hash) {
      window.location.hash = next
    }
  }, [])
  return [route, go]
}
