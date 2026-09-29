import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { nextPosition, sortByPos } from '../lib/utils'
import Icon from './Icon'
import { Avatar, CheckButton, DueLabel, ProjectDot } from './common'

export default function TopBar({ route, onMenu, openTask }) {
  const { state, meId, actions } = useStore()
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const inputRef = useRef(null)

  // "/" キーで検索へ
  useEffect(() => {
    const f = e => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return Object.values(state.tasks)
      .filter(t => t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s))
      .sort((a, b) => Number(a.completed) - Number(b.completed) || (b.updated_at > a.updated_at ? 1 : -1))
      .slice(0, 10)
  }, [q, state.tasks])

  const create = () => {
    let fields = { assignee_id: meId }
    if (route.view === 'project' && state.projects[route.id]) {
      const sec = sortByPos(Object.values(state.sections).filter(s => s.project_id === route.id))[0]
      const siblings = Object.values(state.tasks).filter(t => t.project_id === route.id && t.section_id === (sec?.id || null) && !t.parent_id)
      fields = { project_id: route.id, section_id: sec?.id || null, position: nextPosition(siblings) }
    }
    const t = actions.createTask(fields)
    openTask(t.id)
  }

  return (
    <header className="topbar">
      <button type="button" className="icon-btn only-mobile" onClick={onMenu} aria-label="メニュー"><Icon name="menu" size={20} /></button>
      <button type="button" className="btn btn-primary btn-sm" onClick={create}><Icon name="plus" size={14} /> 作成</button>
      <div className="search">
        <Icon name="search" size={15} />
        <input ref={inputRef} value={q} placeholder="タスクを検索（/）" onChange={e => setQ(e.target.value)}
          onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
          onKeyDown={e => { if (e.key === 'Escape') { setQ(''); e.target.blur() } }} />
        {focus && q.trim() && (
          <div className="search-results">
            {results.length === 0 && <div className="search-empty">見つかりませんでした</div>}
            {results.map(t => {
              const p = state.projects[t.project_id]
              return (
                <div role="button" tabIndex={0} key={t.id} className="search-item" onMouseDown={e => e.preventDefault()}
                  onClick={() => { openTask(t.id); setQ(''); inputRef.current?.blur() }}>
                  <CheckButton done={t.completed} onToggle={() => actions.updateTask(t.id, { completed: !t.completed })} size={16} />
                  <span className={'ellipsis' + (t.completed ? ' done-text' : '')}>{t.title || '(無題)'}</span>
                  {p && <span className="search-proj"><ProjectDot color={p.color} size={8} /> {p.name}</span>}
                  <DueLabel due={t.due_date} completed={t.completed} />
                  <Avatar user={state.profiles[t.assignee_id]} size={20} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </header>
  )
}
