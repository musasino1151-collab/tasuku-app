export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  }))

export const byId = rows => Object.fromEntries(rows.map(r => [r.id, r]))

export function dateStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export const todayStr = () => dateStr()

export function addDays(str, n) {
  const [y, m, d] = str.split('-').map(Number)
  return dateStr(new Date(y, m - 1, d + n))
}

export function diffDays(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000)
}

const WD = '日月火水木金土'
export function formatDue(due) {
  if (!due) return ''
  const diff = diffDays(due, todayStr())
  if (diff === 0) return '今日'
  if (diff === 1) return '明日'
  if (diff === -1) return '昨日'
  const [y, m, d] = due.split('-').map(Number)
  const wd = WD[new Date(y, m - 1, d).getDay()]
  if (diff > 1 && diff < 7) return `${wd}曜日`
  return (y !== new Date().getFullYear() ? `${y}/` : '') + `${m}月${d}日`
}

export function dueClass(due, completed) {
  if (!due || completed) return ''
  const diff = diffDays(due, todayStr())
  if (diff < 0) return 'overdue'
  if (diff <= 1) return 'soon'
  return ''
}

export function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  const diff = diffDays(dateStr(d), todayStr())
  if (diff === 0) return `今日 ${hm}`
  if (diff === -1) return `昨日 ${hm}`
  const y = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}/` : ''
  return `${y}${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

export const PRIORITY = {
  high: { label: '高', cls: 'p-high' },
  medium: { label: '中', cls: 'p-med' },
  low: { label: '低', cls: 'p-low' },
}

export const COLORS = [
  '#f06a6a', '#ec8d71', '#f1bd6c', '#f8df72', '#aecf55', '#5da283', '#4ecbc4', '#9ee7e3',
  '#4573d2', '#8d84e8', '#b36bd4', '#f9aaef', '#f26fb2', '#fc979a', '#6d6e6f', '#c7c4c4',
]

export const sortByPos = arr => [...arr].sort((a, b) => a.position - b.position || (a.created_at < b.created_at ? -1 : 1))

// list: 移動するタスクを除いた並び順どおりの配列
export function positionBefore(list, beforeId) {
  if (!beforeId) {
    const last = list[list.length - 1]
    return last ? last.position + 1024 : 1024
  }
  const i = list.findIndex(t => t.id === beforeId)
  if (i < 0) return positionBefore(list, null)
  const next = list[i]
  const prev = list[i - 1]
  return prev ? (prev.position + next.position) / 2 : next.position - 1024
}

export const nextPosition = list => list.reduce((m, t) => Math.max(m, t.position), 0) + 1024
