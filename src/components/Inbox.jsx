import { useState } from 'react'
import { useStore } from '../store'
import { formatDue, formatTime } from '../lib/utils'
import Icon from './Icon'
import { Avatar, ProjectDot } from './common'

const TEXT = {
  assigned: 'あなたにタスクを割り当てました',
  comment: 'コメントしました',
  mention: 'コメントであなたをメンションしました',
  completed: 'あなたが依頼したタスクを完了しました',
  due_today: '今日が期限です',
  due_tomorrow: '明日が期限です',
}

export default function Inbox({ openTask, activeTask }) {
  const { state, actions } = useStore()
  const [tab, setTab] = useState('all')
  const list = Object.values(state.notifications)
    .filter(n => tab === 'all' || !n.read_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const unread = Object.values(state.notifications).filter(n => !n.read_at).length

  return (
    <div className="page">
      <div className="page-head">
        <h1>受信トレイ</h1>
        <div className="tabs">
          <button type="button" className={'tab' + (tab === 'all' ? ' active' : '')} onClick={() => setTab('all')}>すべて</button>
          <button type="button" className={'tab' + (tab === 'unread' ? ' active' : '')} onClick={() => setTab('unread')}>未読 {unread > 0 && <span className="badge">{unread}</span>}</button>
        </div>
      </div>
      <div className="toolbar">
        <span className="small muted">自分宛ての割り当て・コメント・期限のお知らせ（メールでも届きます）</span>
        <button type="button" className="btn btn-sm" onClick={actions.markAllRead} disabled={!unread}>すべて既読にする</button>
      </div>
      <div className="inbox">
        {list.length === 0 && (
          <div className="empty">
            <Icon name="inbox" size={36} stroke={1.5} />
            <p>{tab === 'unread' ? '未読の通知はありません' : 'まだ通知はありません'}</p>
          </div>
        )}
        {list.map(n => {
          const t = state.tasks[n.task_id]
          const p = t && state.projects[t.project_id]
          const actor = state.profiles[n.actor_id]
          const isDue = n.kind.startsWith('due')
          return (
            <button type="button" key={n.id}
              className={'inbox-item' + (n.read_at ? '' : ' unread') + (activeTask && activeTask === n.task_id ? ' active' : '')}
              onClick={() => { actions.markRead(n.id); if (t) openTask(t.id) }}>
              {isDue
                ? <span className="avatar avatar-due" style={{ width: 32, height: 32 }}><Icon name="calendar" size={16} /></span>
                : <Avatar user={actor} size={32} />}
              <div className="inbox-main">
                <div className="inbox-line">
                  {!isDue && <b>{actor?.name || '誰か'}さんが</b>}
                  <span className={isDue ? 'due-text' : ''}>{TEXT[n.kind] || '更新しました'}</span>
                  <span className="muted small ml-auto">{formatTime(n.created_at)}</span>
                </div>
                <div className="inbox-task">
                  <span className={t?.completed ? 'done-text' : ''}>{t ? (t.title || '(無題)') : `${n.body || ''}（削除済み）`}</span>
                  {p && <span className="proj-chip"><ProjectDot color={p.color} size={8} /> {p.name}</span>}
                  {t?.due_date && <span className="muted small">期限 {formatDue(t.due_date)}</span>}
                </div>
                {(n.kind === 'comment' || n.kind === 'mention') && n.body && <div className="inbox-quote">{n.body}</div>}
              </div>
              {!n.read_at && <span className="dot" aria-label="未読" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
