import { useStore } from '../store'
import Icon from './Icon'
import { CheckButton } from './common'
import { useTaskMenu } from './TaskMenu'
import { DatePicker, InlineTitle, PersonPicker, PriorityPicker, ProjectPicker } from './pickers'

// リスト表示の 1 行：各セルをその場で編集できる
export function TaskRow({ task, active, onOpen, onToggle, onEdit, showProject = false, dnd, autoFocus = false }) {
  const { state, actions } = useStore()
  const menu = useTaskMenu()
  const subs = Object.values(state.tasks).filter(t => t.parent_id === task.id)
  const subsDone = subs.filter(t => t.completed).length
  const update = patch => { onEdit?.(task.id); actions.updateTask(task.id, patch) }

  const setProject = ({ project_id, section_id }) => {
    const siblings = Object.values(state.tasks).filter(t => t.project_id === project_id && t.section_id === section_id)
    update({ project_id, section_id, position: siblings.reduce((m, t) => Math.max(m, t.position), 0) + 1024 })
    subs.forEach(s => actions.updateTask(s.id, { project_id }))
  }

  return (
    <div className={'task-row' + (active ? ' active' : '') + (task.completed ? ' is-done' : '') + (dnd?.over ? ' drop-before' : '')}
      onClick={() => onOpen(task.id)}
      onContextMenu={e => menu(e, task.id)}
      onDragOver={dnd?.onDragOver} onDragLeave={dnd?.onDragLeave} onDrop={dnd?.onDrop}>
      <div className="col-title">
        {dnd && (
          <span className="drag-handle" draggable onDragStart={dnd.onDragStart} onDragEnd={dnd.onDragEnd}
            onClick={e => e.stopPropagation()} title="ドラッグで移動"><Icon name="drag" size={14} /></span>
        )}
        <CheckButton done={task.completed} onToggle={onToggle} />
        <InlineTitle value={task.title} done={task.completed} autoFocus={autoFocus} placeholder="(無題のタスク)"
          onOpen={() => onOpen(task.id)} onSave={title => update({ title })} />
        {subs.length > 0 && <span className="meta-chip" title="サブタスク"><Icon name="subtask" size={12} />{subsDone}/{subs.length}</span>}
        <button type="button" className="detail-btn" onClick={e => { e.stopPropagation(); onOpen(task.id) }}>
          詳細 <Icon name="chevron" size={12} />
        </button>
      </div>
      {showProject && (
        <div className="col-project cell" onClick={e => e.stopPropagation()}>
          <ProjectPicker projectId={task.project_id} sectionId={task.section_id} onChange={setProject} disabled={!!task.parent_id} />
        </div>
      )}
      <div className="col-assignee cell" onClick={e => e.stopPropagation()}>
        <PersonPicker value={task.assignee_id} onChange={v => update({ assignee_id: v })} />
      </div>
      <div className="col-due cell" onClick={e => e.stopPropagation()}>
        <DatePicker value={task.due_date} startValue={task.start_date} completed={task.completed}
          onChange={v => update({ due_date: v })} />
      </div>
      <div className="col-priority cell hide-sm" onClick={e => e.stopPropagation()}>
        <PriorityPicker value={task.priority} onChange={v => update({ priority: v })} />
      </div>
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
