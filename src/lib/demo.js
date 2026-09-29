import { addDays, byId, todayStr } from './utils'

// VITE_DEMO=1 のときだけ使うサンプルデータ
export function demoData(meId) {
  const t = todayStr()
  const ago = h => new Date(Date.now() - h * 3600e3).toISOString()
  const partner = 'demo-partner'
  const staff = 'demo-staff'
  const profiles = [
    { id: meId, email: 'you@example.com', name: 'セシル', color: '#f06a6a', email_notify: true },
    { id: partner, email: 'partner@example.com', name: '山田', color: '#4573d2', email_notify: true },
    { id: staff, email: 'staff@example.com', name: '佐藤', color: '#5da283', email_notify: true },
  ]
  const projects = [
    { id: 'p1', name: 'ドバイ輸出', color: '#f1bd6c', description: '', archived: false, position: 1024, created_at: ago(200) },
    { id: 'p2', name: 'ECサイト立ち上げ', color: '#4573d2', description: '', archived: false, position: 2048, created_at: ago(100) },
  ]
  const sections = [
    { id: 's1', project_id: 'p1', name: '未着手', position: 1024 },
    { id: 's2', project_id: 'p1', name: '進行中', position: 2048 },
    { id: 's3', project_id: 'p1', name: '確認待ち', position: 3072 },
    { id: 's4', project_id: 'p2', name: '未着手', position: 1024 },
    { id: 's5', project_id: 'p2', name: '進行中', position: 2048 },
    { id: 's6', project_id: 'p2', name: '確認待ち', position: 3072 },
  ]
  let pos = 0
  const task = (id, title, extra) => ({
    id, title, description: '', project_id: null, section_id: null, parent_id: null, assignee_id: null,
    due_date: null, priority: null, completed: false, completed_at: null, position: (pos += 1024),
    created_by: meId, created_at: ago(50), updated_at: ago(1), ...extra,
  })
  const tasks = [
    task('t1', '見積書を送付', { project_id: 'p1', section_id: 's2', assignee_id: meId, due_date: t, priority: 'high', description: 'CIF条件で再見積もり。' }),
    task('t2', 'サンプル発送の手配', { project_id: 'p1', section_id: 's1', assignee_id: partner, due_date: addDays(t, 1), priority: 'medium' }),
    task('t3', '成分表を英訳', { project_id: 'p1', section_id: 's1', assignee_id: staff, due_date: addDays(t, 4) }),
    task('t4', '輸入登録の必要書類を確認', { project_id: 'p1', section_id: 's3', assignee_id: meId, due_date: addDays(t, -1), priority: 'high', created_by: partner }),
    task('t5', 'パッケージデザイン案', { project_id: 'p1', section_id: 's2', assignee_id: partner, due_date: addDays(t, 9) }),
    task('t6', '商品ページの文章', { project_id: 'p2', section_id: 's4', assignee_id: meId, due_date: addDays(t, 3), priority: 'low', created_by: partner }),
    task('t7', '決済設定', { project_id: 'p2', section_id: 's5', assignee_id: partner }),
    task('t8', '配送料テーブル作成', { project_id: 'p2', section_id: 's4', assignee_id: staff, due_date: addDays(t, 12) }),
    task('t9', '銀行に連絡', { assignee_id: meId, due_date: addDays(t, 2) }),
    task('t10', '先方と打ち合わせ日程を決める', { project_id: 'p1', section_id: 's1', completed: true, completed_at: ago(3), assignee_id: meId }),
    task('t11', '価格表PDF', { parent_id: 't1', project_id: 'p1', assignee_id: meId, completed: true }),
    task('t12', '送付メールの文面', { parent_id: 't1', project_id: 'p1', assignee_id: partner }),
  ]
  const notifications = [
    { id: 'n1', user_id: meId, actor_id: partner, task_id: 't4', kind: 'assigned', body: '輸入登録の必要書類を確認', created_at: ago(2), read_at: null },
    { id: 'n2', user_id: meId, actor_id: partner, task_id: 't1', kind: 'comment', body: '価格表の最新版はドライブに入れました！', created_at: ago(5), read_at: null },
    { id: 'n3', user_id: meId, actor_id: null, task_id: 't1', kind: 'due_today', body: '見積書を送付', created_at: ago(9), read_at: ago(8) },
  ]
  const comments = [
    { id: 'c1', task_id: 't1', author_id: partner, body: '価格表の最新版はドライブに入れました！', created_at: ago(5) },
  ]
  const activities = [
    { id: 'a1', task_id: 't1', actor_id: meId, kind: 'created', data: {}, created_at: ago(50) },
    { id: 'a2', task_id: 't1', actor_id: meId, kind: 'assigned', data: { to: meId }, created_at: ago(50) },
  ]
  return {
    profiles: byId(profiles), projects: byId(projects), sections: byId(sections), tasks: byId(tasks),
    notifications: byId(notifications), comments: byId(comments), activities: byId(activities),
  }
}
