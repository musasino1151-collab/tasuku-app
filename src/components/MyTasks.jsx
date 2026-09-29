import { useState } from 'react'
import { useStore } from '../store'
import { diffDays, todayStr } from '../lib/utils'
import Icon from './Icon'
import { QuickAdd, useKeepVisible } from './common'
import { TaskHeader, TaskRow } from './TaskRow'

const GROUPS = [
  { key: 'overdue', label: '期限切れ' },
  { key: 'today', label: '今日' },
  { key: 'week', label: '今後 7 日間' },
  { key: 'later', label: 'それ以降' },
  { key: 'none', label: '期限なし' },
]

function groupOf(t, today) {
  if (!t.due_date) return 'none'
  const d = diffDays(t.due_date, today)
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= 7) return 'week'
  return 'later'
}

export default function MyTasks({ sub, go, openTask }) {
  const { state, meId, actions } = useStore()
  const [showDone, setShowDone] = useState(false)
  const [keep, addKeep] = useKeepVisible()
  const [collapsed, setCollapsed] = useState({})
  const today = todayStr()
  const requested = sub === 'requested'

  const base = Object.values(state.tasks).filter(t =>
    requested ? t.created_by === meId && t.assignee_id && t.assignee_id !== meId : t.assignee_id === meId)
  const add = fields => actions.createTask(fields)
  const open = base.filter(t => !t.completed || keep.has(t.id))
  const done = base.filter(t => t.completed && !keep.has(t.id))
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '')).slice(0, 100)

  const groups = GROUPS.map(g => ({
    ...g,
    tasks: open.filter(t => groupOf(t, today) === g.key)
      .sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9') || a.created_at.localeCompare(b.created_at)),
  })).filter(g => g.tasks.length || g.key === 'today')

  const toggle = t => {
    if (!t.completed) addKeep(t.id)
    actions.updateTask(t.id, { completed: !t.completed })
  }

  const counts = {
    overdue: open.filter(t => !t.completed && groupOf(t, today) === 'overdue').length,
    today: open.filter(t => !t.completed && groupOf(t, today) === 'today').length,
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>マイタスク</h1>
        <div className="tabs">
          <button type="button" className={'tab' + (!requested ? ' active' : '')} onClick={() => go({ view: 'my', id: null })}>自分の担当</button>
          <button type="button" className={'tab' + (requested ? ' active' : '')} onClick={() => go({ view: 'my', id: 'requested' })}>依頼したタスク</button>
        </div>
      </div>
      <div className="toolbar">
        <div className="stats">
          {counts.overdue > 0 && <span className="stat overdue">期限切れ {counts.overdue}</span>}
          <span className="stat">今日 {counts.today}</span>
          <span className="stat">未完了 {open.filter(t => !t.completed).length}</span>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> 完了済みも表示
        </label>
      </div>

      <div className="task-table">
        <TaskHeader showProject />
        {!requested && (
          <div className="quick-row">
            <QuickAdd placeholder="タスクを追加…（Enter で連続追加）" onAdd={title => add({ title, assignee_id: meId })} />
          </div>
        )}
        {groups.map(g => (
          <div key={g.key} className="group">
            <button type="button" className={'group-head' + (g.key === 'overdue' ? ' overdue' : '')}
              onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))}>
              <Icon name={collapsed[g.key] ? 'chevron' : 'chevronDown'} size={14} />
              {g.label} <span className="count">{g.tasks.length}</span>
            </button>
            {!collapsed[g.key] && g.tasks.map(t => (
              <TaskRow key={t.id} task={t} showProject onOpen={openTask} onToggle={() => toggle(t)} />
            ))}
            {!collapsed[g.key] && g.key === 'today' && !requested && (
              <div className="quick-row indent">
                <QuickAdd placeholder="今日のタスクを追加…"
                  onAdd={title => add({ title, assignee_id: meId, due_date: today })} />
              </div>
            )}
          </div>
        ))}
        {showDone && (
          <div className="group">
            <div className="group-head static">完了済み <span className="count">{done.length}</span></div>
            {done.map(t => <TaskRow key={t.id} task={t} showProject onOpen={openTask} onToggle={() => toggle(t)} />)}
          </div>
        )}
        {!base.length && (
          <div className="empty">
            {requested ? '他のメンバーに依頼したタスクはここに表示されます。' : 'あなたに割り当てられたタスクはまだありません。'}
          </div>
        )}
      </div>
      <p className="hint">タスク名をクリックで詳細　·　ダブルクリックで名前を編集　·　各欄はクリックでその場で変更　·　右クリックでメニュー</p>
    </div>
  )
}
