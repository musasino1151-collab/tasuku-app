import { useState } from 'react'
import { useStore } from '../store'
import Icon from './Icon'
import { EditableText, Menu, QuickAdd } from './common'
import { TaskHeader, TaskRow } from './TaskRow'

export default function ListView({ project, groups, openTask, toggle, move, addTask, onEdit }) {
  const { actions } = useStore()
  const [drag, setDrag] = useState(null)       // ドラッグ中のタスク ID
  const [over, setOver] = useState(null)       // 'task:<id>' | 'sec:<id>'
  const [collapsed, setCollapsed] = useState({})
  const [renaming, setRenaming] = useState(null)
  const [addingSection, setAddingSection] = useState(false)

  const end = () => { setDrag(null); setOver(null) }
  const rowDnd = (task, sectionId) => ({
    over: over === 'task:' + task.id && drag !== task.id,
    onDragStart: e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', task.id); setDrag(task.id) },
    onDragEnd: end,
    onDragOver: e => { if (!drag) return; e.preventDefault(); e.stopPropagation(); setOver('task:' + task.id) },
    onDragLeave: () => {},
    onDrop: e => { e.preventDefault(); e.stopPropagation(); if (drag && drag !== task.id) move(drag, sectionId, task.id); end() },
  })
  const secDrop = sectionId => ({
    onDragOver: e => { if (!drag) return; e.preventDefault(); setOver('sec:' + sectionId) },
    onDrop: e => { e.preventDefault(); if (drag) move(drag, sectionId, null); end() },
  })

  return (
    <div className="task-table">
      <TaskHeader />
      {groups.map(g => {
        const key = g.id || 'none'
        return (
          <div key={key} className={'group' + (over === 'sec:' + g.id ? ' drop-target' : '')} {...secDrop(g.id)}>
            <div className="group-head">
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}>
                <Icon name={collapsed[key] ? 'chevron' : 'chevronDown'} size={14} />
              </button>
              {g.virtual ? <span className="group-name">{g.name}</span> : (
                <EditableText className="group-name" value={g.name}
                  editing={renaming === g.id} setEditing={v => setRenaming(v ? g.id : null)}
                  onSave={name => actions.updateSection(g.id, { name })} />
              )}
              <span className="count">{g.tasks.length}</span>
              {!g.virtual && (
                <Menu items={[
                  { label: '名前を変更', onClick: () => setRenaming(g.id) },
                  {
                    label: 'セクションを削除', danger: true, onClick: () => {
                      if (confirm(`セクション「${g.name}」を削除します（タスクは「セクションなし」に移動します）`)) actions.deleteSection(g.id)
                    },
                  },
                ]} />
              )}
            </div>
            {!collapsed[key] && (
              <>
                {g.tasks.map(t => (
                  <TaskRow key={t.id} task={t} onOpen={openTask} onToggle={() => toggle(t)} onEdit={onEdit} dnd={rowDnd(t, g.id)} />
                ))}
                <div className="quick-row indent">
                  <QuickAdd onAdd={title => addTask(g.id, title)} />
                </div>
              </>
            )}
          </div>
        )
      })}
      <div className="add-section">
        {addingSection ? (
          <input className="quick-add-input" autoFocus placeholder="セクション名"
            onBlur={e => { if (e.target.value.trim()) actions.createSection(project.id, e.target.value.trim()); setAddingSection(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.target.blur()
              if (e.key === 'Escape') { e.target.value = ''; e.target.blur() }
            }} />
        ) : (
          <button type="button" className="quick-add-btn" onClick={() => setAddingSection(true)}>
            <Icon name="plus" size={14} /> セクションを追加
          </button>
        )}
      </div>
    </div>
  )
}
