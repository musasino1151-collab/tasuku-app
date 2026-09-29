import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { PRIORITY, addDays, dateStr, formatDue, sortByPos, todayStr } from '../lib/utils'
import Icon from './Icon'
import { Avatar, ProjectDot, useMembers } from './common'

// ------------------------------------------------------------
// 画面のどこに置いても切れないポップオーバー
// ------------------------------------------------------------
export function Popover({ anchor, onClose, children, width = 280 }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    const place = () => {
      if (!anchor) return
      const r = anchor.getBoundingClientRect()
      const h = ref.current?.offsetHeight || 320
      const w = Math.min(width, window.innerWidth - 16)
      let left = Math.min(r.left, window.innerWidth - w - 8)
      left = Math.max(8, left)
      let top = r.bottom + 4
      if (top + h > window.innerHeight - 8 && r.top - h - 4 > 8) top = r.top - h - 4
      setPos({ top, left, width: w })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, width])

  useEffect(() => {
    const down = e => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return
      onClose()
    }
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('mousedown', down)
    window.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('mousedown', down)
      window.removeEventListener('keydown', key, true)
    }
  }, [anchor, onClose])

  return createPortal(
    <div ref={ref} className="popover" style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? width }}
      onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      {children}
    </div>,
    document.body,
  )
}

// トリガー + ポップオーバーの共通部品
function usePicker() {
  const [anchor, setAnchor] = useState(null)
  const open = e => {
    e.stopPropagation()
    const el = e.currentTarget // 先に取り出す（後で読むと null になる）
    setAnchor(a => (a ? null : el))
  }
  const close = () => setAnchor(null)
  return { anchor, open, close }
}

// 検索＋キーボード操作つきのリスト
function SearchList({ items, onPick, placeholder, renderItem, autoFocus = true, footer }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const listRef = useRef(null)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? items.filter(it => it.search.toLowerCase().includes(s)) : items
  }, [q, items])
  useEffect(() => { setIdx(0) }, [q])
  useEffect(() => {
    listRef.current?.children[idx]?.scrollIntoView({ block: 'nearest' })
  }, [idx])
  return (
    <div className="picker">
      <div className="picker-search">
        <Icon name="search" size={14} />
        <input autoFocus={autoFocus} value={q} placeholder={placeholder} onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, filtered.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && filtered[idx]) { e.preventDefault(); onPick(filtered[idx]) }
          }} />
      </div>
      <div className="picker-list" ref={listRef}>
        {filtered.length === 0 && <div className="picker-empty">見つかりません</div>}
        {filtered.map((it, i) => (
          <button key={it.key} type="button" className={'picker-item' + (i === idx ? ' hover' : '') + (it.selected ? ' selected' : '')}
            onMouseEnter={() => setIdx(i)} onClick={() => onPick(it)}>
            {renderItem(it)}
            {it.selected && <Icon name="check" size={14} className="ml-auto" />}
          </button>
        ))}
      </div>
      {footer}
    </div>
  )
}

// ------------------------------------------------------------
// 担当者
// ------------------------------------------------------------
export function PersonPicker({ value, onChange, variant = 'cell', placeholder = '担当者' }) {
  const { state, meId } = useStore()
  const members = useMembers()
  const p = usePicker()
  const user = state.profiles[value]
  const items = useMemo(() => [
    ...members.map(m => ({ key: m.id, id: m.id, search: m.name + ' ' + m.email, user: m, selected: m.id === value })),
  ].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0)), [members, value, meId])

  return (
    <>
      <button type="button" className={'pick-trigger pick-' + variant + (user ? '' : ' empty')} onClick={p.open}>
        <Avatar user={user} size={variant === 'field' ? 24 : 22} />
        <span className="ellipsis">{user ? user.name : (variant === 'cell' ? '' : placeholder)}</span>
        {variant === 'field' && user && (
          <span role="button" tabIndex={0} className="pick-clear" aria-label="担当者を外す"
            onClick={e => { e.stopPropagation(); onChange(null) }}><Icon name="x" size={12} /></span>
        )}
      </button>
      {p.anchor && (
        <Popover anchor={p.anchor} onClose={p.close}>
          <SearchList items={items} placeholder="名前またはメールで検索"
            onPick={it => { onChange(it.id); p.close() }}
            renderItem={it => (<><Avatar user={it.user} size={22} /><span className="ellipsis">{it.user.name}{it.id === meId && <span className="muted small">（自分）</span>}</span><span className="muted small ellipsis picker-sub">{it.user.email}</span></>)}
            footer={value && (
              <button type="button" className="picker-foot" onClick={() => { onChange(null); p.close() }}>
                <Icon name="x" size={12} /> 担当者を外す
              </button>
            )} />
        </Popover>
      )}
    </>
  )
}

// ------------------------------------------------------------
// プロジェクト（＋セクション）
// ------------------------------------------------------------
export function ProjectPicker({ projectId, sectionId, onChange, variant = 'cell', disabled = false }) {
  const { state } = useStore()
  const p = usePicker()
  const project = state.projects[projectId]
  const section = state.sections[sectionId]
  const items = useMemo(() => {
    const out = []
    const projects = sortByPos(Object.values(state.projects).filter(x => !x.archived || x.id === projectId))
    for (const pr of projects) {
      const secs = sortByPos(Object.values(state.sections).filter(s => s.project_id === pr.id))
      out.push({ key: pr.id, projectId: pr.id, sectionId: secs[0]?.id || null, project: pr, search: pr.name, selected: pr.id === projectId && (!sectionId || !secs.length) })
      for (const s of secs) {
        out.push({ key: pr.id + ':' + s.id, projectId: pr.id, sectionId: s.id, project: pr, section: s, search: pr.name + ' ' + s.name, selected: pr.id === projectId && s.id === sectionId })
      }
    }
    return out
  }, [state.projects, state.sections, projectId, sectionId])

  return (
    <>
      <button type="button" className={'pick-trigger pick-' + variant + (project ? '' : ' empty')} onClick={disabled ? undefined : p.open} disabled={disabled}>
        {project ? (
          <span className={variant === 'cell' ? 'proj-chip' : 'row-gap'}>
            <ProjectDot color={project.color} size={variant === 'cell' ? 8 : 10} />
            <span className="ellipsis">{project.name}</span>
            {variant === 'field' && section && <span className="muted small ellipsis">／ {section.name}</span>}
          </span>
        ) : <span className="muted">{variant === 'cell' ? '' : 'プロジェクトに追加'}</span>}
      </button>
      {p.anchor && (
        <Popover anchor={p.anchor} onClose={p.close} width={320}>
          <SearchList items={items} placeholder="プロジェクト・セクションを検索"
            onPick={it => { onChange({ project_id: it.projectId, section_id: it.sectionId }); p.close() }}
            renderItem={it => it.section
              ? <span className="picker-indent row-gap"><span className="muted">└</span><span className="ellipsis">{it.section.name}</span></span>
              : <span className="row-gap"><ProjectDot color={it.project.color} /><b className="ellipsis">{it.project.name}</b></span>}
            footer={projectId && (
              <button type="button" className="picker-foot" onClick={() => { onChange({ project_id: null, section_id: null }); p.close() }}>
                <Icon name="x" size={12} /> プロジェクトから外す
              </button>
            )} />
        </Popover>
      )}
    </>
  )
}

// ------------------------------------------------------------
// 日付
// ------------------------------------------------------------
function nextMonday() {
  const d = new Date()
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
  return dateStr(d)
}

export function Calendar({ value, onPick, rangeStart }) {
  const init = value ? new Date(value + 'T00:00') : new Date()
  const [cursor, setCursor] = useState(new Date(init.getFullYear(), init.getMonth(), 1))
  const start = new Date(cursor)
  start.setDate(1 - start.getDay())
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  const today = todayStr()
  return (
    <div className="mini-cal">
      <div className="mini-cal-head">
        <button type="button" className="icon-btn icon-btn-sm" onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}><Icon name="chevronLeft" size={14} /></button>
        <b>{cursor.getFullYear()}年 {cursor.getMonth() + 1}月</b>
        <button type="button" className="icon-btn icon-btn-sm" onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}><Icon name="chevron" size={14} /></button>
      </div>
      <div className="mini-cal-grid">
        {'日月火水木金土'.split('').map(w => <span key={w} className="mini-wd">{w}</span>)}
        {days.map(d => {
          const ds = dateStr(d)
          const inRange = rangeStart && value && ds > rangeStart && ds < value
          return (
            <button key={ds} type="button"
              className={'mini-day' + (d.getMonth() !== cursor.getMonth() ? ' other' : '') + (ds === today ? ' today' : '') +
                (ds === value || ds === rangeStart ? ' sel' : '') + (inRange ? ' in-range' : '')}
              onClick={() => onPick(ds)}>{d.getDate()}</button>
          )
        })}
      </div>
    </div>
  )
}

export function DatePicker({ value, onChange, startValue, onStartChange, variant = 'cell', completed = false }) {
  const p = usePicker()
  const [target, setTarget] = useState('due')
  const hasStart = !!onStartChange
  const cls = !value || completed ? '' : value < todayStr() ? ' overdue' : value <= addDays(todayStr(), 1) ? ' soon' : ''
  const label = value
    ? (startValue ? `${formatDue(startValue)} – ${formatDue(value)}` : formatDue(value))
    : (variant === 'cell' ? '' : '期限なし')

  const pick = ds => {
    if (hasStart && target === 'start') {
      onStartChange(ds)
      if (value && ds > value) onChange(ds)
      setTarget('due')
      return
    }
    if (hasStart && startValue && ds < startValue) onStartChange(null)
    onChange(ds)
    p.close()
  }

  return (
    <>
      <button type="button" className={'pick-trigger pick-' + variant + (value ? '' : ' empty')} onClick={e => { setTarget('due'); p.open(e) }}>
        {variant === 'field' && <span className="pick-icon"><Icon name="calendar" size={14} /></span>}
        <span className={'due' + cls}>{label}</span>
        {variant === 'field' && value && (
          <span role="button" tabIndex={0} className="pick-clear" aria-label="日付を削除"
            onClick={e => { e.stopPropagation(); onChange(null); onStartChange?.(null) }}><Icon name="x" size={12} /></span>
        )}
      </button>
      {p.anchor && (
        <Popover anchor={p.anchor} onClose={p.close} width={288}>
          {hasStart && (
            <div className="date-fields">
              <button type="button" className={'date-field' + (target === 'start' ? ' active' : '')} onClick={() => setTarget('start')}>
                <span className="small muted">開始日</span><span>{startValue ? formatDue(startValue) : '—'}</span>
              </button>
              <button type="button" className={'date-field' + (target === 'due' ? ' active' : '')} onClick={() => setTarget('due')}>
                <span className="small muted">期限</span><span>{value ? formatDue(value) : '—'}</span>
              </button>
            </div>
          )}
          <div className="date-quick">
            {[['今日', todayStr()], ['明日', addDays(todayStr(), 1)], ['来週月曜', nextMonday()], ['1週間後', addDays(todayStr(), 7)]].map(([l, d]) => (
              <button key={l} type="button" className="chip-btn" onClick={() => pick(d)}>{l}</button>
            ))}
          </div>
          <Calendar key={target} value={target === 'start' ? startValue : value} rangeStart={target === 'due' ? startValue : null} onPick={pick} />
          <div className="picker-foot-row">
            {hasStart && target === 'start' && startValue && <button type="button" className="link-btn" onClick={() => { onStartChange(null); setTarget('due') }}>開始日を削除</button>}
            {value && <button type="button" className="link-btn danger" onClick={() => { onChange(null); onStartChange?.(null); p.close() }}>日付をクリア</button>}
          </div>
        </Popover>
      )}
    </>
  )
}

// ------------------------------------------------------------
// 優先度
// ------------------------------------------------------------
export function PriorityPicker({ value, onChange, variant = 'cell' }) {
  const p = usePicker()
  const opts = [['high', '高'], ['medium', '中'], ['low', '低']]
  return (
    <>
      <button type="button" className={'pick-trigger pick-' + variant + (value ? '' : ' empty')} onClick={p.open}>
        {value ? <span className={'pill ' + PRIORITY[value].cls}>{PRIORITY[value].label}</span> : <span className="muted">{variant === 'cell' ? '' : 'なし'}</span>}
      </button>
      {p.anchor && (
        <Popover anchor={p.anchor} onClose={p.close} width={160}>
          <div className="picker-list">
            {opts.map(([k, l]) => (
              <button key={k} type="button" className={'picker-item' + (value === k ? ' selected' : '')} onClick={() => { onChange(k); p.close() }}>
                <span className={'pill ' + PRIORITY[k].cls}>{l}</span>
                {value === k && <Icon name="check" size={14} className="ml-auto" />}
              </button>
            ))}
            <button type="button" className="picker-item" onClick={() => { onChange(null); p.close() }}><span className="muted">なし</span></button>
          </div>
        </Popover>
      )}
    </>
  )
}

// ------------------------------------------------------------
// 一覧上で名前をそのまま編集する欄
// ------------------------------------------------------------
// クリック → 詳細を開く（onOpen がある場合）／ダブルクリック → その場で名前を編集
export function InlineTitle({ value, onSave, onOpen, className = '', placeholder = 'タスク名', autoFocus = false, done = false }) {
  const [v, setV] = useState(value)
  const [focus, setFocus] = useState(false)
  const [editing, setEditing] = useState(!onOpen || autoFocus)
  const ref = useRef(null)
  const clickTimer = useRef(null)
  useEffect(() => () => clearTimeout(clickTimer.current), [])
  useEffect(() => { if (!focus) setV(value) }, [value, focus])
  useEffect(() => { if (autoFocus || (editing && onOpen)) ref.current?.focus() }, [autoFocus, editing, onOpen])
  if (!editing) {
    return (
      <span className={'inline-title as-text ' + className + (done ? ' done-text' : '')} title="クリックで詳細 / ダブルクリックで名前を編集"
        onClick={e => {
          e.stopPropagation()
          clearTimeout(clickTimer.current)
          clickTimer.current = setTimeout(() => onOpen(), 220) // ダブルクリックと区別する
        }}
        onDoubleClick={e => { e.stopPropagation(); clearTimeout(clickTimer.current); setEditing(true) }}>
        {value || <span className="muted">{placeholder}</span>}
      </span>
    )
  }
  return (
    <input ref={ref} className={'inline-title ' + className + (done ? ' done-text' : '')} value={v} placeholder={placeholder}
      onClick={e => e.stopPropagation()}
      onFocus={() => setFocus(true)}
      onChange={e => setV(e.target.value)}
      onBlur={() => { setFocus(false); if (onOpen) setEditing(false); if (v !== value) onSave(v) }}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); e.target.blur() }
        if (e.key === 'Escape') { setV(value); setTimeout(() => e.target.blur()) }
      }} />
  )
}
