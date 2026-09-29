import { useStore } from '../store'
import Icon from './Icon'
import { Avatar, CheckButton, DueLabel, PriorityPill, ProjectDot } from './common'

// リスト表示の 1 行
export function TaskRow({ task, active, onOpen, onToggle, showProject = false, dnd }) {
  const { state } = useStore()
  const assignee = state.profiles[task.assignee_id]
  const project = state.projects[task.project_id]
  const subs = Object.values(state.tasks).filter(t => t.parent_id === task.id)
  const subsDone = subs.filter(t => t.completed).length

  return (
    <div className={'task-row' + (active ? ' active' : '') + (task.completed ? ' is-done' : '') + (dnd?.over ? ' drop-before' : '')}
      onClick={() => onOpen(task.id)}
      draggable={!!dnd} onDragStart={dnd?.onDragStart} onDragEnd={dnd?.onDragEnd}
      onDragOver={dnd?.onDragOver} onDragLeave={dnd?.onDragLeave} onDrop={dnd?.onDrop}>
      <div className="col-title">
        {dnd && <span className="drag-handle"><Icon name="drag" size={14} /></span>}
        <CheckButton done={task.completed} onToggle={onToggle} />
        <span className={'task-title' + (task.completed ? ' done-text' : '')}>{task.title || <span className="muted">(無題のタスク)</span>}</span>
        {subs.length > 0 && <span className="meta-chip" title="サブタスク"><Icon name="subtask" size={12} />{subsDone}/{subs.length}</span>}
      </div>
      {showProject && (
        <div className="col-project">
          {project ? <span className="proj-chip"><ProjectDot color={project.color} size={8} /> <span className="ellipsis">{project.name}</span></span> : null}
        </div>
      )}
      <div className="col-assignee">
        <Avatar user={assignee} size={22} />
        <span className="ellipsis hide-sm">{assignee?.name || ''}</span>
      </div>
      <div className="col-due"><DueLabel due={task.due_date} completed={task.completed} /></div>
      <div className="col-priority hide-sm"><PriorityPill value={task.priority} /></div>
    </div>
  )
}

export function TaskHeader({ showProject }) {
  return (
    <div className="task-row task-head">
      <div className="col-title">タスク名</div>
      {showProject && <div className="col-project">プロジェクト</div>}
      <div className="col-assignee">担当者</div>
      <div className="col-due">期限</div>
      <div className="col-priority hide-sm">優先度</div>
    </div>
  )
}
