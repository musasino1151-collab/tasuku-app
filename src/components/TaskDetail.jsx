import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { formatDue, formatTime, nextPosition, sortByPos, todayStr, addDays } from '../lib/utils'
import Icon from './Icon'
import { AssigneeSelect, Avatar, CheckButton, DueLabel, Menu, ProjectDot } from './common'

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
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description)
  const [comment, setComment] = useState('')
  const [newSub, setNewSub] = useState('')
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
  const sections = sortByPos(Object.values(state.sections).filter(s => s.project_id === task.project_id))
  const projects = Object.values(state.projects).filter(p => !p.archived || p.id === task.project_id)
    .sort((a, b) => a.position - b.position)

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

  const setProject = pid => {
    const first = sortByPos(Object.values(state.sections).filter(s => s.project_id === pid))[0]
    const siblings = Object.values(state.tasks).filter(t => t.project_id === pid && t.section_id === (first?.id || null))
    actions.updateTask(task.id, { project_id: pid || null, section_id: first?.id || null, position: nextPosition(siblings) })
    subs.forEach(s => actions.updateTask(s.id, { project_id: pid || null }))
  }

  const sendComment = () => {
    const body = comment.trim()
    if (!body) return
    actions.addComment(task.id, body)
    setComment('')
  }

  const addSub = () => {
    const t = newSub.trim()
    if (!t) return
    actions.createTask({ title: t, parent_id: task.id, project_id: task.project_id, position: nextPosition(subs) })
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
              <Avatar user={state.profiles[task.assignee_id]} size={24} />
              <AssigneeSelect value={task.assignee_id} onChange={v => actions.updateTask(task.id, { assignee_id: v })} className="select-ghost" />
              {task.assignee_id !== meId && (
                <button type="button" className="link-btn" onClick={() => actions.updateTask(task.id, { assignee_id: meId })}>自分に割り当て</button>
              )}
            </div>

            <label className="f-label">期限</label>
            <div className="f-value">
              <input type="date" className="select select-ghost" value={task.due_date || ''}
                onChange={e => actions.updateTask(task.id, { due_date: e.target.value || null })} />
              {task.due_date ? (
                <>
                  <DueLabel due={task.due_date} completed={task.completed} />
                  <button type="button" className="icon-btn icon-btn-sm" onClick={() => actions.updateTask(task.id, { due_date: null })} aria-label="期限を削除"><Icon name="x" size={12} /></button>
                </>
              ) : (
                <span className="row-gap">
                  <button type="button" className="link-btn" onClick={() => actions.updateTask(task.id, { due_date: todayStr() })}>今日</button>
                  <button type="button" className="link-btn" onClick={() => actions.updateTask(task.id, { due_date: addDays(todayStr(), 1) })}>明日</button>
                  <button type="button" className="link-btn" onClick={() => actions.updateTask(task.id, { due_date: addDays(todayStr(), 7) })}>1週間後</button>
                </span>
              )}
            </div>

            <label className="f-label">プロジェクト</label>
            <div className="f-value">
              {project && <ProjectDot color={project.color} />}
              <select className="select select-ghost" value={task.project_id || ''} onChange={e => setProject(e.target.value || null)} disabled={!!parent}>
                <option value="">なし</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {project && !parent && (
                <select className="select select-ghost" value={task.section_id || ''} onChange={e => actions.updateTask(task.id, { section_id: e.target.value || null })}>
                  <option value="">セクションなし</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {project && (
                <button type="button" className="link-btn" onClick={() => go({ view: 'project', id: project.id, tab: 'list', task: task.id })}>開く</button>
              )}
            </div>

            <label className="f-label">優先度</label>
            <div className="f-value">
              <select className={'select select-ghost prio-' + (task.priority || 'none')} value={task.priority || ''}
                onChange={e => actions.updateTask(task.id, { priority: e.target.value || null })}>
                <option value="">なし</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
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
              {subs.map(s => (
                <div key={s.id} className={'subtask' + (s.completed ? ' is-done' : '')} onClick={() => openTask(s.id)}>
                  <CheckButton done={s.completed} size={16} onToggle={() => actions.updateTask(s.id, { completed: !s.completed })} />
                  <span className={'ellipsis' + (s.completed ? ' done-text' : '')}>{s.title || '(無題)'}</span>
                  <span className="ml-auto row-gap">
                    <DueLabel due={s.due_date} completed={s.completed} />
                    <Avatar user={state.profiles[s.assignee_id]} size={20} />
                  </span>
                </div>
              ))}
              <div className="subtask subtask-new">
                <Icon name="plus" size={14} />
                <input value={newSub} placeholder="サブタスクを追加（Enter）" onChange={e => setNewSub(e.target.value)}
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
                  <div className="comment-body">{item.body}</div>
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
          <div className="composer-box">
            <textarea value={comment} rows={comment.includes('\n') ? 4 : 2} placeholder="コメントを書く…（⌘/Ctrl + Enter で送信）"
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendComment() } }} />
            <div className="composer-foot">
              <span className="small muted">担当者・作成者・過去のコメント投稿者に通知されます</span>
              <button type="button" className="btn btn-primary btn-sm" disabled={!comment.trim()} onClick={sendComment}>送信</button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
