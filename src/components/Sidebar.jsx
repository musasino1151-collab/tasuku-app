import { useState } from 'react'
import { useStore } from '../store'
import { APP_NAME } from '../lib/supabase'
import { sortByPos } from '../lib/utils'
import Icon from './Icon'
import { Avatar, ProjectDot, useMembers } from './common'

export default function Sidebar({ route, nav, onNewProject, onSettings }) {
  const { state, me, meId } = useStore()
  const members = useMembers()
  const [showArchived, setShowArchived] = useState(false)
  const projects = sortByPos(Object.values(state.projects))
  const active = projects.filter(p => !p.archived)
  const archived = projects.filter(p => p.archived)
  const unread = Object.values(state.notifications).filter(n => !n.read_at).length
  const myOpen = Object.values(state.tasks).filter(t => t.assignee_id === meId && !t.completed).length

  const Item = ({ on, onClick, children, badge, count }) => (
    <button type="button" className={'side-item' + (on ? ' active' : '')} onClick={onClick}>
      {children}
      {badge > 0 && <span className="badge">{badge}</span>}
      {!badge && count > 0 && <span className="side-count">{count}</span>}
    </button>
  )

  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark" />{APP_NAME}</div>
      <nav className="side-nav">
        <Item on={route.view === 'my'} onClick={() => nav({ view: 'my' })} count={myOpen}>
          <Icon name="circleCheck" size={18} /> マイタスク
        </Item>
        <Item on={route.view === 'inbox'} onClick={() => nav({ view: 'inbox' })} badge={unread}>
          <Icon name="inbox" size={18} /> 受信トレイ
        </Item>
      </nav>

      <div className="side-head">
        <span>プロジェクト</span>
        <button type="button" className="icon-btn icon-btn-dark" onClick={onNewProject} aria-label="プロジェクトを作成"><Icon name="plus" /></button>
      </div>
      <div className="side-projects">
        {active.map(p => (
          <Item key={p.id} on={route.view === 'project' && route.id === p.id}
            onClick={() => nav({ view: 'project', id: p.id, tab: route.view === 'project' ? route.tab : 'list' })}>
            <ProjectDot color={p.color} /> <span className="ellipsis">{p.name}</span>
          </Item>
        ))}
        {!active.length && <button type="button" className="side-empty" onClick={onNewProject}>＋ 最初のプロジェクトを作成</button>}
        {archived.length > 0 && (
          <>
            <button type="button" className="side-sub" onClick={() => setShowArchived(s => !s)}>
              <Icon name={showArchived ? 'chevronDown' : 'chevron'} size={12} /> アーカイブ（{archived.length}）
            </button>
            {showArchived && archived.map(p => (
              <Item key={p.id} on={route.view === 'project' && route.id === p.id} onClick={() => nav({ view: 'project', id: p.id, tab: 'list' })}>
                <ProjectDot color={p.color} /> <span className="ellipsis muted-dark">{p.name}</span>
              </Item>
            ))}
          </>
        )}
      </div>

      <div className="side-foot">
        <div className="side-members">
          <span className="side-label">メンバー {members.length}人</span>
          <div className="avatar-stack">
            {members.slice(0, 8).map(m => <Avatar key={m.id} user={m} size={24} />)}
          </div>
        </div>
        <button type="button" className="side-item" onClick={onSettings}>
          <Avatar user={me} size={22} /> <span className="ellipsis">{me.name}</span>
          <Icon name="settings" size={15} className="ml-auto" />
        </button>
      </div>
    </aside>
  )
}
