import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { nextPosition, positionBefore, sortByPos } from '../lib/utils'
import Icon from './Icon'
import { Avatar, Menu, useKeepVisible, useMembers } from './common'
import ListView from './ListView'
import BoardView from './BoardView'
import CalendarView from './CalendarView'

export default function ProjectView({ project, tab, go, openTask, onEdit }) {
  const { state, actions, meId } = useStore()
  const members = useMembers()
  const [filter, setFilter] = useState('open')
  const [assignee, setAssignee] = useState('')
  const [keep, addKeep] = useKeepVisible()

  const sections = useMemo(
    () => sortByPos(Object.values(state.sections).filter(s => s.project_id === project.id)),
    [state.sections, project.id])
  const secIds = useMemo(() => new Set(sections.map(s => s.id)), [sections])
  const secOf = t => (t.section_id && secIds.has(t.section_id) ? t.section_id : null)

  const all = useMemo(
    () => Object.values(state.tasks).filter(t => t.project_id === project.id && !t.parent_id),
    [state.tasks, project.id])

  const visible = all.filter(t => {
    if (assignee === 'me' ? t.assignee_id !== meId : assignee && t.assignee_id !== assignee) return false
    if (filter === 'all') return true
    if (filter === 'open') return !t.completed || keep.has(t.id)
    return t.completed
  })

  const groups = [
    ...(all.some(t => !secOf(t)) ? [{ id: null, name: 'セクションなし', virtual: true }] : []),
    ...sections,
  ].map(s => ({ ...s, tasks: sortByPos(visible.filter(t => secOf(t) === s.id)) }))

  const toggle = t => {
    if (!t.completed) addKeep(t.id)
    actions.updateTask(t.id, { completed: !t.completed })
  }

  const move = (taskId, sectionId, beforeId) => {
    const siblings = sortByPos(all.filter(t => secOf(t) === sectionId && t.id !== taskId))
    actions.updateTask(taskId, { section_id: sectionId, position: positionBefore(siblings, beforeId) })
  }

  const addTask = (sectionId, title, extra = {}) => {
    const siblings = all.filter(t => secOf(t) === sectionId)
    return actions.createTask({
      title, project_id: project.id, section_id: sectionId, position: nextPosition(siblings),
      assignee_id: assignee && assignee !== 'me' ? assignee : assignee === 'me' ? meId : null, ...extra,
    })
  }

  const openCount = all.filter(t => !t.completed).length
  const doneCount = all.length - openCount
  const pct = all.length ? Math.round((doneCount / all.length) * 100) : 0
  const people = [...new Set(all.map(t => t.assignee_id).filter(Boolean))].map(id => state.profiles[id]).filter(Boolean)

  const common = { project, groups, openTask, toggle, move, addTask }

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div className="proj-title">
          <span className="proj-icon" style={{ background: project.color }}><Icon name="list" size={16} /></span>
          <h1 className="ellipsis">{project.name}</h1>
          {project.archived && <span className="pill p-archived">アーカイブ済み</span>}
          <Menu align="left" items={[
            { label: 'プロジェクトを編集', onClick: onEdit },
            { label: project.archived ? 'アーカイブを解除' : 'アーカイブ', onClick: () => actions.updateProject(project.id, { archived: !project.archived }) },
            {
              label: 'プロジェクトを削除', danger: true, onClick: () => {
                if (confirm(`「${project.name}」とタスク ${all.length} 件を削除します。元に戻せません。よろしいですか？`)) {
                  actions.deleteProject(project.id)
                  go({ view: 'my', id: null, task: null })
                }
              },
            },
          ]} />
        </div>
        <div className="tabs">
          {[['list', 'list', 'リスト'], ['board', 'board', 'ボード'], ['calendar', 'calendar', 'カレンダー']].map(([k, ic, label]) => (
            <button key={k} type="button" className={'tab' + (tab === k ? ' active' : '')} onClick={() => go({ tab: k })}>
              <Icon name={ic} size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar">
        <div className="progress" title={`${doneCount}/${all.length} 完了`}>
          <div className="progress-bar"><div style={{ width: pct + '%', background: project.color }} /></div>
          <span className="small muted">{pct}% 完了 · 残り {openCount}</span>
          <div className="avatar-stack">{people.slice(0, 6).map(p => <Avatar key={p.id} user={p} size={22} />)}</div>
        </div>
        <div className="filters">
          <select className="select select-sm" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="open">未完了のタスク</option>
            <option value="done">完了済みのタスク</option>
            <option value="all">すべてのタスク</option>
          </select>
          <select className="select select-sm" value={assignee} onChange={e => setAssignee(e.target.value)}>
            <option value="">担当者：全員</option>
            <option value="me">担当者：自分</option>
            {members.filter(m => m.id !== meId).map(m => <option key={m.id} value={m.id}>担当者：{m.name}</option>)}
          </select>
        </div>
      </div>
      {project.description && <p className="proj-desc">{project.description}</p>}

      {tab === 'board' ? <BoardView {...common} />
        : tab === 'calendar' ? <CalendarView {...common} tasks={visible} />
          : <ListView {...common} />}
    </div>
  )
}
