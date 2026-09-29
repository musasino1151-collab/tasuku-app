import { useState } from 'react'
import { useStore } from '../store'
import Icon from './Icon'
import { Avatar, CheckButton, DueLabel, EditableText, Menu, PriorityPill, QuickAdd } from './common'

export default function BoardView({ project, groups, openTask, toggle, move, addTask }) {
  const { state, actions } = useStore()
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [addingSection, setAddingSection] = useState(false)
  const end = () => { setDrag(null); setOver(null) }

  return (
    <div className="board">
      {groups.map(g => (
        <div key={g.id || 'none'} className={'column' + (over === 'sec:' + g.id ? ' drop-target' : '')}
          onDragOver={e => { if (!drag) return; e.preventDefault(); setOver('sec:' + g.id) }}
          onDrop={e => { e.preventDefault(); if (drag) move(drag, g.id, null); end() }}>
          <div className="column-head">
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
          <div className="column-body">
            {g.tasks.map(t => {
              const subs = Object.values(state.tasks).filter(s => s.parent_id === t.id)
              return (
                <div key={t.id} draggable
                  className={'card' + (t.completed ? ' is-done' : '') + (drag === t.id ? ' dragging' : '') + (over === 'task:' + t.id && drag !== t.id ? ' drop-before' : '')}
                  onClick={() => openTask(t.id)}
                  onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); setDrag(t.id) }}
                  onDragEnd={end}
                  onDragOver={e => { if (!drag) return; e.preventDefault(); e.stopPropagation(); setOver('task:' + t.id) }}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); if (drag && drag !== t.id) move(drag, g.id, t.id); end() }}>
                  <div className="card-top">
                    <CheckButton done={t.completed} onToggle={() => toggle(t)} />
                    <span className={'card-title' + (t.completed ? ' done-text' : '')}>{t.title || '(無題のタスク)'}</span>
                  </div>
                  {(t.priority || subs.length > 0) && (
                    <div className="card-tags">
                      <PriorityPill value={t.priority} />
                      {subs.length > 0 && <span className="meta-chip"><Icon name="subtask" size={12} />{subs.filter(s => s.completed).length}/{subs.length}</span>}
                    </div>
                  )}
                  <div className="card-foot">
                    <Avatar user={state.profiles[t.assignee_id]} size={22} />
                    <DueLabel due={t.due_date} completed={t.completed} />
                  </div>
                </div>
              )
            })}
            <QuickAdd className="board-add" onAdd={title => addTask(g.id, title)} />
          </div>
        </div>
      ))}
      <div className="column column-new">
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
