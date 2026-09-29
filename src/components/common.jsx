import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { useStore } from '../store'
import { PRIORITY, dueClass, formatDue } from '../lib/utils'

export function Avatar({ user, size = 24, title }) {
  if (!user) {
    return (
      <span className="avatar avatar-empty" style={{ width: size, height: size }} title={title || '未割り当て'}>
        <Icon name="user" size={Math.round(size * 0.6)} />
      </span>
    )
  }
  return (
    <span className="avatar" title={title || user.name}
      style={{ width: size, height: size, background: user.color, fontSize: Math.round(size * 0.45) }}>
      {(user.name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

export function CheckButton({ done, onToggle, size = 18 }) {
  return (
    <button type="button" className={'check' + (done ? ' done' : '')} style={{ width: size, height: size }}
      onClick={e => { e.stopPropagation(); onToggle() }} aria-label={done ? '未完了に戻す' : '完了にする'}>
      <Icon name="check" size={size - 6} stroke={3} />
    </button>
  )
}

export function DueLabel({ due, completed }) {
  if (!due) return null
  return <span className={'due ' + dueClass(due, completed)}>{formatDue(due)}</span>
}

export function PriorityPill({ value }) {
  if (!value) return null
  const p = PRIORITY[value]
  return <span className={'pill ' + p.cls}>{p.label}</span>
}

export function ProjectDot({ color, size = 10 }) {
  return <span className="project-dot" style={{ background: color, width: size, height: size }} />
}

export function useMembers() {
  const { state } = useStore()
  return Object.values(state.profiles).sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

export function AssigneeSelect({ value, onChange, className = '' }) {
  const members = useMembers()
  return (
    <select className={'select ' + className} value={value || ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">未割り当て</option>
      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  )
}

// クリック外で閉じるメニュー
export function Menu({ items, icon = 'dots', label, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="icon-btn" onClick={e => { e.stopPropagation(); setOpen(o => !o) }} aria-label={label || 'メニュー'}>
        <Icon name={icon} />
      </button>
      {open && (
        <div className={'menu menu-' + align}>
          {items.filter(Boolean).map(it => (
            <button key={it.label} type="button" className={'menu-item' + (it.danger ? ' danger' : '')}
              onClick={e => { e.stopPropagation(); setOpen(false); it.onClick() }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Enter で次々追加できる入力
export function QuickAdd({ placeholder = 'タスクを追加…', onAdd, autoFocus = false, onCancel, className = '' }) {
  const [editing, setEditing] = useState(autoFocus)
  const [v, setV] = useState('')
  if (!editing) {
    return (
      <button type="button" className={'quick-add-btn ' + className} onClick={() => setEditing(true)}>
        <Icon name="plus" size={14} /> {placeholder.replace('…', '')}
      </button>
    )
  }
  const done = () => { setV(''); setEditing(false); onCancel?.() }
  return (
    <input className={'quick-add-input ' + className} autoFocus value={v} placeholder={placeholder}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if (v.trim()) onAdd(v.trim()); done() }}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault()
          if (v.trim()) onAdd(v.trim())
          setV('')
        } else if (e.key === 'Escape') done()
      }} />
  )
}

// 完了直後のタスクをしばらく表示し続ける（Asana と同じ挙動）
export function useKeepVisible() {
  const [keep, setKeep] = useState(() => new Set())
  const add = id => setKeep(s => new Set(s).add(id))
  return [keep, add]
}

export function Modal({ title, onClose, children, footer, width = 460 }) {
  useEffect(() => {
    const f = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function EditableText({ value, onSave, className = '', placeholder = '', editing: editingProp, setEditing: setEditingProp }) {
  const [editingState, setEditingState] = useState(false)
  const editing = editingProp ?? editingState
  const setEditing = setEditingProp ?? setEditingState
  const [v, setV] = useState(value)
  useEffect(() => { if (!editing) setV(value) }, [value, editing])
  if (!editing) {
    return <span className={className} onDoubleClick={() => setEditing(true)} title="ダブルクリックで編集">{value || placeholder}</span>
  }
  const commit = () => { setEditing(false); if (v.trim() && v.trim() !== value) onSave(v.trim()) }
  return (
    <input className={'inline-edit ' + className} autoFocus value={v} onChange={e => setV(e.target.value)} onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) commit()
        if (e.key === 'Escape') { setV(value); setEditing(false) }
      }} />
  )
}
