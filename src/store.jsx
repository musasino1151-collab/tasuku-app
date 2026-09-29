import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { supabase, DEMO } from './lib/supabase'
import { byId, uid } from './lib/utils'
import { demoData } from './lib/demo'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const TABLES = ['profiles', 'projects', 'sections', 'tasks', 'notifications', 'comments', 'activities']

function reducer(state, a) {
  switch (a.type) {
    case 'init':
      return { ...state, ...a.data, loaded: true }
    case 'upsert': {
      const cur = state[a.table][a.row.id]
      return { ...state, [a.table]: { ...state[a.table], [a.row.id]: cur ? { ...cur, ...a.row } : a.row } }
    }
    case 'upsertMany': {
      if (!a.rows.length) return state
      const m = { ...state[a.table] }
      for (const r of a.rows) m[r.id] = m[r.id] ? { ...m[r.id], ...r } : r
      return { ...state, [a.table]: m }
    }
    case 'remove': {
      const ids = Array.isArray(a.id) ? a.id : [a.id]
      if (!ids.some(id => state[a.table][id])) return state
      const m = { ...state[a.table] }
      for (const id of ids) delete m[id]
      return { ...state, [a.table]: m }
    }
    case 'patchWhere': {
      const m = { ...state[a.table] }
      let changed = false
      for (const [id, r] of Object.entries(m)) {
        if (a.where(r)) { m[id] = { ...r, ...a.patch }; changed = true }
      }
      return changed ? { ...state, [a.table]: m } : state
    }
    default:
      return state
  }
}

async function fetchAll(table) {
  const size = 1000
  const out = []
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(from, from + size - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < size) break
  }
  return out
}

export function StoreProvider({ session, children }) {
  const meId = session.user.id
  const [state, dispatch] = useReducer(reducer, null, () => ({
    ...Object.fromEntries(TABLES.map(t => [t, {}])),
    loaded: false,
  }))
  const stateRef = useRef(state)
  stateRef.current = state
  const [toast, setToast] = useState(null)

  const notify = useCallback(msg => setToast({ msg, key: Date.now() }), [])
  const fail = useCallback((error, revert) => {
    console.error(error)
    if (revert) revert()
    notify('保存できませんでした：' + (error?.message || error))
  }, [notify])

  const lastLoad = useRef(0)
  const loadAll = useCallback(async () => {
    lastLoad.current = Date.now()
    if (DEMO) {
      if (!stateRef.current.loaded) dispatch({ type: 'init', data: demoData(meId) })
      return
    }
    try {
      const [profiles, projects, sections, tasks, notifs] = await Promise.all([
        fetchAll('profiles'),
        fetchAll('projects'),
        fetchAll('sections'),
        fetchAll('tasks'),
        supabase.from('notifications').select('*').eq('user_id', meId)
          .order('created_at', { ascending: false }).limit(300)
          .then(r => { if (r.error) throw r.error; return r.data }),
      ])
      dispatch({
        type: 'init',
        data: {
          profiles: byId(profiles), projects: byId(projects), sections: byId(sections),
          tasks: byId(tasks), notifications: byId(notifs),
        },
      })
    } catch (e) {
      fail(e)
    }
  }, [meId, fail])

  // 初回読み込み + リアルタイム購読
  useEffect(() => {
    loadAll()
    if (DEMO) return
    const apply = table => p => {
      if (p.eventType === 'DELETE') dispatch({ type: 'remove', table, id: p.old.id })
      else dispatch({ type: 'upsert', table, row: p.new })
    }
    let first = true
    const ch = supabase.channel('realtime-' + meId)
    for (const table of ['profiles', 'projects', 'sections', 'tasks', 'comments', 'activities']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, apply(table))
    }
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${meId}` }, apply('notifications'))
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        if (!first) loadAll() // 再接続時に取りこぼしを回収
        first = false
      }
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > 30000) loadAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(ch)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [meId, loadAll])

  const actions = useMemo(() => {
    const now = () => new Date().toISOString()
    const run = async (makeQuery, revert) => {
      if (DEMO) return true
      const { error } = await makeQuery()
      if (error) { fail(error, revert); return false }
      return true
    }
    const S = () => stateRef.current

    const a = {
      // ---------- タスク ----------
      createTask(fields) {
        const row = {
          id: uid(), title: '', description: '', project_id: null, section_id: null, parent_id: null,
          assignee_id: null, due_date: null, priority: null, completed: false, completed_at: null,
          position: Date.now(), created_by: meId, created_at: now(), updated_at: now(), ...fields,
        }
        dispatch({ type: 'upsert', table: 'tasks', row })
        if (DEMO) a._demoActivity(row.id, 'created')
        const { completed_at, updated_at, ...insert } = row
        run(() => supabase.from('tasks').insert(insert), () => dispatch({ type: 'remove', table: 'tasks', id: row.id }))
        return row
      },
      updateTask(id, patch) {
        const prev = S().tasks[id]
        if (!prev) return
        const local = { id, ...patch, updated_at: now() }
        if ('completed' in patch) local.completed_at = patch.completed ? now() : null
        dispatch({ type: 'upsert', table: 'tasks', row: local })
        if (DEMO && 'completed' in patch) a._demoActivity(id, patch.completed ? 'completed' : 'reopened')
        run(() => supabase.from('tasks').update(patch).eq('id', id), () => dispatch({ type: 'upsert', table: 'tasks', row: prev }))
      },
      deleteTask(id) {
        const all = S().tasks
        const removed = []
        const collect = tid => {
          if (!all[tid]) return
          removed.push(all[tid])
          Object.values(all).filter(t => t.parent_id === tid).forEach(t => collect(t.id))
        }
        collect(id)
        dispatch({ type: 'remove', table: 'tasks', id: removed.map(t => t.id) })
        run(() => supabase.from('tasks').delete().eq('id', id),
          () => dispatch({ type: 'upsertMany', table: 'tasks', rows: removed }))
      },

      // ---------- プロジェクト ----------
      createProject({ name, color, description = '' }) {
        const projects = Object.values(S().projects)
        const project = {
          id: uid(), name, color, description, archived: false,
          position: projects.reduce((m, p) => Math.max(m, p.position), 0) + 1024,
          created_by: meId, created_at: now(),
        }
        const sections = ['未着手', '進行中', '確認待ち'].map((n, i) => ({
          id: uid(), project_id: project.id, name: n, position: (i + 1) * 1024, created_at: now(),
        }))
        dispatch({ type: 'upsert', table: 'projects', row: project })
        dispatch({ type: 'upsertMany', table: 'sections', rows: sections })
        run(async () => {
          const r = await supabase.from('projects').insert(project)
          if (r.error) return r
          return supabase.from('sections').insert(sections)
        }, () => {
          dispatch({ type: 'remove', table: 'projects', id: project.id })
          dispatch({ type: 'remove', table: 'sections', id: sections.map(s => s.id) })
        })
        return project
      },
      updateProject(id, patch) {
        const prev = S().projects[id]
        dispatch({ type: 'upsert', table: 'projects', row: { id, ...patch } })
        run(() => supabase.from('projects').update(patch).eq('id', id), () => dispatch({ type: 'upsert', table: 'projects', row: prev }))
      },
      deleteProject(id) {
        const s = S()
        const prev = s.projects[id]
        const secs = Object.values(s.sections).filter(x => x.project_id === id)
        const tasks = Object.values(s.tasks).filter(x => x.project_id === id)
        dispatch({ type: 'remove', table: 'projects', id })
        dispatch({ type: 'remove', table: 'sections', id: secs.map(x => x.id) })
        dispatch({ type: 'remove', table: 'tasks', id: tasks.map(x => x.id) })
        run(() => supabase.from('projects').delete().eq('id', id), () => {
          dispatch({ type: 'upsert', table: 'projects', row: prev })
          dispatch({ type: 'upsertMany', table: 'sections', rows: secs })
          dispatch({ type: 'upsertMany', table: 'tasks', rows: tasks })
        })
      },

      // ---------- セクション ----------
      createSection(projectId, name) {
        const list = Object.values(S().sections).filter(x => x.project_id === projectId)
        const row = {
          id: uid(), project_id: projectId, name,
          position: list.reduce((m, x) => Math.max(m, x.position), 0) + 1024, created_at: now(),
        }
        dispatch({ type: 'upsert', table: 'sections', row })
        run(() => supabase.from('sections').insert(row), () => dispatch({ type: 'remove', table: 'sections', id: row.id }))
        return row
      },
      updateSection(id, patch) {
        const prev = S().sections[id]
        dispatch({ type: 'upsert', table: 'sections', row: { id, ...patch } })
        run(() => supabase.from('sections').update(patch).eq('id', id), () => dispatch({ type: 'upsert', table: 'sections', row: prev }))
      },
      deleteSection(id) {
        const prev = S().sections[id]
        dispatch({ type: 'remove', table: 'sections', id })
        dispatch({ type: 'patchWhere', table: 'tasks', where: t => t.section_id === id, patch: { section_id: null } })
        run(() => supabase.from('sections').delete().eq('id', id), () => dispatch({ type: 'upsert', table: 'sections', row: prev }))
      },

      // ---------- コメント / アクティビティ ----------
      async loadTaskFeed(taskId) {
        if (DEMO) return
        const [c, act] = await Promise.all([
          supabase.from('comments').select('*').eq('task_id', taskId),
          supabase.from('activities').select('*').eq('task_id', taskId),
        ])
        if (c.error || act.error) return fail(c.error || act.error)
        dispatch({ type: 'upsertMany', table: 'comments', rows: c.data })
        dispatch({ type: 'upsertMany', table: 'activities', rows: act.data })
      },
      addComment(taskId, body, mentions = []) {
        const row = { id: uid(), task_id: taskId, author_id: meId, body, created_at: now() }
        if (mentions.length) row.mentions = mentions
        dispatch({ type: 'upsert', table: 'comments', row })
        run(() => supabase.from('comments').insert(row), () => dispatch({ type: 'remove', table: 'comments', id: row.id }))
      },
      deleteComment(id) {
        const prev = S().comments[id]
        dispatch({ type: 'remove', table: 'comments', id })
        run(() => supabase.from('comments').delete().eq('id', id), () => dispatch({ type: 'upsert', table: 'comments', row: prev }))
      },
      _demoActivity(taskId, kind, data = {}) {
        dispatch({ type: 'upsert', table: 'activities', row: { id: uid(), task_id: taskId, actor_id: meId, kind, data, created_at: now() } })
      },

      // ---------- 通知 ----------
      markRead(id) {
        const n = S().notifications[id]
        if (!n || n.read_at) return
        dispatch({ type: 'upsert', table: 'notifications', row: { id, read_at: now() } })
        run(() => supabase.from('notifications').update({ read_at: now() }).eq('id', id))
      },
      markAllRead() {
        const ids = Object.values(S().notifications).filter(n => !n.read_at).map(n => n.id)
        if (!ids.length) return
        dispatch({ type: 'upsertMany', table: 'notifications', rows: ids.map(id => ({ id, read_at: now() })) })
        run(() => supabase.from('notifications').update({ read_at: now() }).in('id', ids))
      },

      // ---------- プロフィール ----------
      updateProfile(patch) {
        const prev = S().profiles[meId]
        dispatch({ type: 'upsert', table: 'profiles', row: { id: meId, ...patch } })
        run(() => supabase.from('profiles').update(patch).eq('id', meId), () => dispatch({ type: 'upsert', table: 'profiles', row: prev }))
      },
      async changePassword(password) {
        if (DEMO) return true
        const { error } = await supabase.auth.updateUser({ password })
        if (error) { fail(error); return false }
        return true
      },
      signOut() {
        if (DEMO) return notify('デモモードです')
        supabase.auth.signOut()
      },
    }
    return a
  }, [meId, fail, notify])

  const value = useMemo(() => ({
    state, meId, me: state.profiles[meId] || { id: meId, name: session.user.email, color: '#6d6e6f' },
    actions, notify,
  }), [state, meId, actions, notify, session.user.email])

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && <Toast key={toast.key} msg={toast.msg} onDone={() => setToast(null)} />}
    </Ctx.Provider>
  )
}

function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [onDone])
  return <div className="toast" role="status">{msg}</div>
}
