import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { formatDue, formatTime, nextPosition, sortByPos } from '../lib/utils'
import Icon from './Icon'
import { useTaskMenu } from './TaskMenu'
import { CommentBody, CommentComposer } from './mentions'
import { Avatar, CheckButton, Menu } from './common'
import { DatePicker, InlineTitle, PersonPicker, PriorityPicker, ProjectPicker } from './pickers'

function useAutoSave(value, save, delay = 700) {
  const timer = useRef(null)
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(save, delay)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
}

function autoGrow(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

export default function TaskDetail({ task, onClose, openTask, go }) {
  const { state, meId, actions, notify } = useStore()
  const menu = useTaskMenu()
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description)
  const [newSub, setNewSub] = useState('')
  const [lastSub, setLastSub] = useState(null)
  const focused = useRef({ title: false, desc: false })
  const titleRef = useRef(null)
  const descRef = useRef(null)
  const latest = useRef({})
  latest.current = { title, desc, task, state }

  // 他の人の編集を反映（入力中は上書きしない）
  useEffect(() => { if (!focused.current.title) setTitle(task.title) }, [task.title])
  useEffect(() => { if (!focused.current.desc) setDesc(task.description) }, [task.description])
  useEffect(() => { autoGrow(titleRef.current) }, [title])
  useEffect(() => { autoGrow(descRef.current) }, [desc])

  const saveTitle = () => {
    const { title: v, task: t } = latest.current
    if (t && v !== t.title) actions.updateTask(t.id, { title: v })
  }
  const saveDesc = () => {
    const { desc: v, task: t } = latest.current
    if (t && v !== t.description) actions.updateTask(t.id, { description: v })
  }
  useAutoSave(title, saveTitle)
  useAutoSave(desc, saveDesc, 1000)

  useEffect(() => {
    actions.loadTaskFeed(task.id)
    if (!task.title) titleRef.current?.focus()
    // 閉じるとき：未保存分を保存し、空のまま放置されたタスクは削除
    return () => {
      const { title: v, desc: d, task: t, state: s } = latest.current
      if (!s.tasks[t.id]) return
      const hasSubs = Object.values(s.tasks).some(x => x.parent_id === t.id)
      const fresh = Date.now() - new Date(t.created_at).getTime() < 30 * 60e3
      if (!v.trim() && !d.trim() && !hasSubs && t.created_by === meId && fresh) {
        actions.deleteTask(t.id)
        return
      }
      if (v !== t.title || d !== t.description) actions.updateTask(t.id, { title: v, description: d })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

  useEffect(() => {
    const f = e => {
      if (e.key === 'Escape' && !document.querySelector('.modal-backdrop')) onClose()
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])

  const project = state.projects[task.project_id]
  const parent = state.tasks[task.parent_id]
  const creator = state.profiles[task.created_by]
  const subs = sortByPos(Object.values(state.tasks).filter(t => t.parent_id === task.id))

  const feed = useMemo(() => {
    const c = Object.values(state.comments).filter(x => x.task_id === task.id).map(x => ({ ...x, _type: 'comment' }))
    const a = Object.values(state.activities).filter(x => x.task_id === task.id).map(x => ({ ...x, _type: 'activity' }))
    return [...c, ...a].sort((x, y) => x.created_at.localeCompare(y.created_at))
  }, [state.comments, state.activities, task.id])

  const name = id => (id ? state.profiles[id]?.name || '不明なユーザー' : 'システム')
  const describe = a => {
    const who = name(a.actor_id)
    switch (a.kind) {
      case 'created': return `${who}がタスクを作成しました`
      case 'assigned':
        if (!a.data?.to) return `${who}が割り当てを解除しました`
        return a.data.to === a.actor_id ? `${who}が自分に割り当てました` : `${who}が${name(a.data.to)}さんに割り当てました`
      case 'completed': return `${who}が完了にしました`
      case 'reopened': return `${who}が未完了に戻しました`
      case 'due': return a.data?.to ? `${who}が期限を${formatDue(a.data.to)}に変更しました` : `${who}が期限を削除しました`
      case 'moved': return `${who}がプロジェクトを「${state.projects[a.data?.to]?.name || 'なし'}」に変更しました`
      default: return `${who}が更新しました`
    }
  }

  const setProject = ({ project_id, section_id }) => {
    const siblings = Object.values(state.tasks).filter(t => t.project_id === project_id && t.section_id === section_id)
    actions.updateTask(task.id, { project_id, section_id, position: nextPosition(siblings) })
    subs.forEach(st => actions.updateTask(st.id, { project_id }))
  }

  const addSub = () => {
    const t = newSub.trim()
    if (!t) return
    const row = actions.createTask({ title: t, parent_id: task.id, project_id: task.project_id, position: nextPosition(subs) })
    setLastSub(row.id)
    setNewSub('')
  }

  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}#/task/${task.id}`
    try { await navigator.clipboard.writeText(url); notify('リンクをコピーしました') } catch { prompt('リンク', url) }
  }

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <aside className="detail" aria-label="タスクの詳細">
        <div className="detail-head">
          <button type="button" className={'btn btn-sm' + (task.completed ? ' btn-done' : '')}
            onClick={() => actions.updateTask(task.id, { completed: !task.completed })}>
            <Icon name="check" size={14} stroke={2.5} /> {task.completed ? '完了済み' : '完了にする'}
          </button>
          <div className="ml-auto row-gap">
            <button type="button" className="icon-btn" onClick={copyLink} title="リンクをコピー"><Icon name="link" /></button>
            <Menu items={[
              { label: 'リンクをコピー', onClick: copyLink },
              {
                label: 'タスクを削除', danger: true, onClick: () => {
                  if (confirm('このタスクを削除しますか？（サブタスクも削除されます）')) { onClose(); actions.deleteTask(task.id) }
                },
              },
            ]} />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる"><Icon name="x" size={18} /></button>
          </div>
        </div>

        <div className="detail-body">
          {task.completed && <div className="done-banner"><Icon name="check" size={14} stroke={3} /> このタスクは完了しています</div>}
          {parent && (
            <button type="button" className="parent-link" onClick={() => openTask(parent.id)}>
              <Icon name="chevronLeft" size={12} /> {parent.title || '(無題)'}
            </button>
          )}
          <textarea ref={titleRef} className="detail-title" rows={1} value={title} placeholder="タスク名を入力"
            onFocus={() => { focused.current.title = true }}
            onBlur={() => { focused.current.title = false; saveTitle() }}
            onChange={e => setTitle(e.target.value.replace(/\n/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); e.target.blur() } }} />

          <div className="fields">
            <label className="f-label">担当者</label>
            <div className="f-value">
              <PersonPicker variant="field" value={task.assignee_id} placeholder="担当者なし"
                onChange={v => actions.updateTask(task.id, { assignee_id: v })} />
              {task.assignee_id !== meId && (
                <button type="button" className="link-btn" onClick={() => actions.updateTask(task.id, { assignee_id: meId })}>自分に割り当て</button>
              )}
            </div>

            <label className="f-label">期日</label>
            <div className="f-value">
              <DatePicker variant="field" value={task.due_date} startValue={task.start_date} completed={task.completed}
                onChange={v => actions.updateTask(task.id, { due_date: v })}
                onStartChange={v => actions.updateTask(task.id, { start_date: v })} />
            </div>

            <label className="f-label">プロジェクト</label>
            <div className="f-value">
              <ProjectPicker variant="field" projectId={task.project_id} sectionId={task.section_id} disabled={!!parent}
                onChange={setProject} />
              {project && (
                <button type="button" className="link-btn" onClick={() => go({ view: 'project', id: project.id, tab: 'list', task: task.id })}>開く</button>
              )}
            </div>

            <label className="f-label">優先度</label>
            <div className="f-value">
              <PriorityPicker variant="field" value={task.priority} onChange={v => actions.updateTask(task.id, { priority: v })} />
            </div>

            <label className="f-label">作成者</label>
            <div className="f-value muted small">
              {creator ? <><Avatar user={creator} size={20} /> {creator.name}</> : '—'} · {formatTime(task.created_at)}
            </div>
          </div>

          <div className="block">
            <div className="block-label">説明</div>
            <textarea ref={descRef} className="detail-desc" value={desc} placeholder="このタスクの詳細、メモ、リンクなど"
              onFocus={() => { focused.current.desc = true }}
              onBlur={() => { focused.current.desc = false; saveDesc() }}
              onChange={e => setDesc(e.target.value)} />
          </div>

          <div className="block">
            <div className="block-label">サブタスク {subs.length > 0 && <span className="count">{subs.filter(s => s.completed).length}/{subs.length}</span>}</div>
            <div className="subtasks">
              {subs.map(st => (
                <div key={st.id} className={'subtask' + (st.completed ? ' is-done' : '')} onClick={() => openTask(st.id)} onContextMenu={e => menu(e, st.id)}>
                  <CheckButton done={st.completed} size={16} onToggle={() => actions.updateTask(st.id, { completed: !st.completed })} />
                  <InlineTitle value={st.title} done={st.completed} placeholder="サブタスク名"
                    onOpen={() => openTask(st.id)} onSave={v => actions.updateTask(st.id, { title: v })} />
                  <span className="sub-cells" onClick={e => e.stopPropagation()}>
                    <DatePicker value={st.due_date} completed={st.completed} onChange={v => actions.updateTask(st.id, { due_date: v })} />
                    <PersonPicker value={st.assignee_id} onChange={v => actions.updateTask(st.id, { assignee_id: v })} />
                  </span>
                  <button type="button" className="detail-btn" onClick={e => { e.stopPropagation(); openTask(st.id) }}>詳細 <Icon name="chevron" size={12} /></button>
                </div>
              ))}
              <div className="subtask subtask-new">
                <Icon name="plus" size={14} />
                <input value={newSub} placeholder="サブタスクを追加（Enter で連続追加）" onChange={e => setNewSub(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addSub() } }}
                  onBlur={addSub} />
              </div>
            </div>
          </div>

          <div className="block feed">
            <div className="block-label">コメント・履歴</div>
            {feed.map(item => item._type === 'comment' ? (
              <div key={'c' + item.id} className="comment">
                <Avatar user={state.profiles[item.author_id]} size={28} />
                <div className="comment-main">
                  <div className="comment-meta">
                    <b>{name(item.author_id)}</b> <span className="muted small">{formatTime(item.created_at)}</span>
                    {item.author_id === meId && (
                      <span className="ml-auto">
                        <Menu items={[{ label: 'コメントを削除', danger: true, onClick: () => actions.deleteComment(item.id) }]} />
                      </span>
                    )}
                  </div>
                  <CommentBody body={item.body} mentions={item.mentions} />
                </div>
              </div>
            ) : (
              <div key={'a' + item.id} className="activity">
                <span>{describe(item)}</span> <span className="muted">· {formatTime(item.created_at)}</span>
              </div>
            ))}
            {creator && !feed.some(f => f.kind === 'created') && (
              <div className="activity">{creator.name}が作成 · {formatTime(task.created_at)}</div>
            )}
          </div>
        </div>

        <div className="composer">
          <Avatar user={state.profiles[meId]} size={28} />
          <CommentComposer onSend={(body, mentions) => actions.addComment(task.id, body, mentions)} />
        </div>
      </aside>
    </>
  )
}
