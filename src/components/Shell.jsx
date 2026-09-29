import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useRoute } from '../lib/route'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MyTasks from './MyTasks'
import Inbox from './Inbox'
import ProjectView from './ProjectView'
import TaskDetail from './TaskDetail'
import ProjectModal from './ProjectModal'
import SettingsModal from './SettingsModal'
import { TaskMenuProvider } from './TaskMenu'

export default function Shell() {
  const { state } = useStore()
  const [route, go] = useRoute()
  const [navOpen, setNavOpen] = useState(false)
  const [modal, setModal] = useState(null)

  // メールのリンク #/task/<id> を適切な画面に振り分け
  useEffect(() => {
    if (route.view !== 'task' || !state.loaded) return
    const t = state.tasks[route.id]
    if (!t) { go({ view: 'inbox', id: null, task: null }, true); return }
    if (t.project_id && state.projects[t.project_id]) go({ view: 'project', id: t.project_id, tab: 'list', task: t.id }, true)
    else go({ view: 'my', id: null, task: t.id }, true)
  }, [route.view, route.id, state.loaded, state.tasks, state.projects, go])

  const openTask = id => go({ task: id })
  const closeTask = () => go({ task: null })
  const nav = r => { go({ id: null, task: null, ...r }); setNavOpen(false) }

  let main
  if (!state.loaded) main = <div className="center-fill"><div className="spinner" /></div>
  else if (route.view === 'inbox') main = <Inbox openTask={openTask} activeTask={route.task} />
  else if (route.view === 'project') {
    const p = state.projects[route.id]
    main = p
      ? <ProjectView project={p} tab={route.tab} go={go} openTask={openTask} onEdit={() => setModal({ type: 'project', project: p })} />
      : <div className="empty">プロジェクトが見つかりません</div>
  } else if (route.view === 'task') main = <div className="center-fill"><div className="spinner" /></div>
  else main = <MyTasks sub={route.id || 'mine'} go={go} openTask={openTask} />

  const task = route.task ? state.tasks[route.task] : null

  return (
    <TaskMenuProvider openTask={openTask} onDeleted={id => { if (route.task === id) closeTask() }}>
    <div className={'shell' + (navOpen ? ' nav-open' : '') + (task ? ' has-detail' : '')}>
      <Sidebar route={route} nav={nav}
        onNewProject={() => { setModal({ type: 'project' }); setNavOpen(false) }}
        onSettings={() => { setModal({ type: 'settings' }); setNavOpen(false) }} />
      <div className="nav-backdrop" onClick={() => setNavOpen(false)} />
      <main className="main">
        <TopBar route={route} onMenu={() => setNavOpen(true)} openTask={openTask} />
        <div className="content">{main}</div>
      </main>
      {task && <TaskDetail key={task.id} task={task} onClose={closeTask} openTask={openTask} go={go} />}
      {modal?.type === 'project' && <ProjectModal project={modal.project} go={go} onClose={() => setModal(null)} />}
      {modal?.type === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
    </div>
    </TaskMenuProvider>
  )
}
