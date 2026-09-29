import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { addDays, todayStr } from '../lib/utils'
import Icon from './Icon'

// 右クリック（スマホは長押し）でタスクのメニューを出す
const Ctx = createContext(() => {})
export const useTaskMenu = () => useContext(Ctx)

export function TaskMenuProvider({ children, openTask, onDeleted }) {
  const [menu, setMenu] = useState(null)
  const show = useCallback((e, taskId) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, taskId })
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {menu && <TaskContextMenu {...menu} openTask={openTask} onDeleted={onDeleted} onClose={() => setMenu(null)} />}
    </Ctx.Provider>
  )
}

function TaskContextMenu({ x, y, taskId, onClose, openTask, onDeleted }) {
  const { state, meId, actions, notify } = useStore()
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const task = state.tasks[taskId]

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
      top: y + h > window.innerHeight - 8 ? Math.max(8, y - h) : y,
    })
  }, [x, y])

  useEffect(() => {
    const close = e => { if (!ref.current?.contains(e.target)) onClose() }
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('mousedown', close)
    document.addEventListener('contextmenu', close)
    window.addEventListener('keydown', key, true)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('contextmenu', close)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  if (!task) return null
  const run = fn => () => { fn(); onClose() }
  const subs = Object.values(state.tasks).filter(t => t.parent_id === task.id)

  const duplicate = () => {
    const { id, created_at, updated_at, completed_at, created_by, ...rest } = task
    const copy = actions.createTask({ ...rest, title: task.title + '（コピー）', completed: false, position: task.position + 0.5 })
    subs.forEach(s => {
      const { id: _i, created_at: _c, updated_at: _u, completed_at: _ca, created_by: _cb, ...r } = s
      actions.createTask({ ...r, parent_id: copy.id, completed: false })
    })
    notify('タスクを複製しました')
  }

  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}#/task/${task.id}`
    try { await navigator.clipboard.writeText(url); notify('リンクをコピーしました') } catch { prompt('リンク', url) }
  }

  const remove = () => {
    const msg = subs.length ? `「${task.title || '無題'}」とサブタスク ${subs.length} 件を削除しますか？` : `「${task.title || '無題'}」を削除しますか？`
    if (!confirm(msg)) return
    onDeleted?.(task.id)
    actions.deleteTask(task.id)
    notify('タスクを削除しました')
  }

  const Item = ({ icon, label, onClick, danger, hint }) => (
    <button type="button" className={'ctx-item' + (danger ? ' danger' : '')} onClick={run(onClick)}>
      <Icon name={icon} size={15} /> <span>{label}</span>{hint && <span className="ctx-hint">{hint}</span>}
    </button>
  )

  return createPortal(
    <div ref={ref} className="ctx-menu" style={pos} role="menu" onContextMenu={e => e.preventDefault()}>
      <div className="ctx-title ellipsis">{task.title || '(無題のタスク)'}</div>
      <Item icon="chevron" label="詳細を開く" onClick={() => openTask(task.id)} />
      <Item icon="check" label={task.completed ? '未完了に戻す' : '完了にする'} onClick={() => actions.updateTask(task.id, { completed: !task.completed })} />
      <div className="ctx-sep" />
      {task.assignee_id !== meId && <Item icon="user" label="自分に割り当て" onClick={() => actions.updateTask(task.id, { assignee_id: meId })} />}
      {task.assignee_id && <Item icon="user" label="担当者を外す" onClick={() => actions.updateTask(task.id, { assignee_id: null })} />}
      <Item icon="calendar" label="期限を今日に" onClick={() => actions.updateTask(task.id, { due_date: todayStr() })} />
      <Item icon="calendar" label="期限を明日に" onClick={() => actions.updateTask(task.id, { due_date: addDays(todayStr(), 1) })} />
      {task.due_date && <Item icon="calendar" label="期限を削除" onClick={() => actions.updateTask(task.id, { due_date: null, start_date: null })} />}
      <div className="ctx-sep" />
      <Item icon="subtask" label="タスクを複製" onClick={duplicate} />
      <Item icon="link" label="リンクをコピー" onClick={copyLink} />
      <div className="ctx-sep" />
      <Item icon="trash" label="タスクを削除" danger onClick={remove} />
    </div>,
    document.body,
  )
}
