import { useState } from 'react'
import { useStore } from '../store'
import { dateStr, todayStr } from '../lib/utils'
import Icon from './Icon'

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

export default function CalendarView({ project, tasks, openTask, addTask }) {
  const { state, actions } = useStore()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const today = todayStr()

  const start = new Date(cursor)
  start.setDate(1 - start.getDay())
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
  // 最終週が丸ごと翌月なら 5 週表示
  const weeks = days[35].getMonth() !== cursor.getMonth() ? 5 : 6
  const shown = days.slice(0, weeks * 7)

  const byDate = {}
  for (const t of tasks) if (t.due_date) (byDate[t.due_date] ||= []).push(t)
  const noDate = tasks.filter(t => !t.due_date && !t.completed).length

  const shift = n => setCursor(c => new Date(c.getFullYear(), c.getMonth() + n, 1))

  const firstSection = Object.values(state.sections)
    .filter(s => s.project_id === project.id).sort((a, b) => a.position - b.position)[0]

  return (
    <div className="calendar">
      <div className="cal-head">
        <button type="button" className="btn btn-sm" onClick={() => setCursor(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })}>今日</button>
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="前の月"><Icon name="chevronLeft" /></button>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="次の月"><Icon name="chevron" /></button>
        <h2>{cursor.getFullYear()}年 {cursor.getMonth() + 1}月</h2>
        {noDate > 0 && <span className="small muted ml-auto">期限なしのタスク {noDate} 件はリストで確認できます</span>}
      </div>
      <div className="cal-grid">
        {WEEK.map((w, i) => <div key={w} className={'cal-wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '')}>{w}</div>)}
        {shown.map(d => {
          const ds = dateStr(d)
          const list = byDate[ds] || []
          const other = d.getMonth() !== cursor.getMonth()
          return (
            <div key={ds} className={'cal-day' + (other ? ' other' : '') + (ds === today ? ' today' : '') + (over === ds ? ' drop-target' : '')}
              onDoubleClick={e => {
                if (e.target !== e.currentTarget && !e.target.classList.contains('cal-num')) return
                const title = prompt(`${d.getMonth() + 1}月${d.getDate()}日 が期限のタスク`)
                if (title?.trim()) addTask(firstSection?.id || null, title.trim(), { due_date: ds })
              }}
              onDragOver={e => { if (!drag) return; e.preventDefault(); setOver(ds) }}
              onDragLeave={() => setOver(o => (o === ds ? null : o))}
              onDrop={e => { e.preventDefault(); if (drag) actions.updateTask(drag, { due_date: ds }); setDrag(null); setOver(null) }}>
              <span className="cal-num">{d.getDate()}</span>
              {list.map(t => {
                const who = state.profiles[t.assignee_id]
                return (
                  <button key={t.id} type="button" draggable className={'cal-chip' + (t.completed ? ' is-done' : '')}
                    style={{ borderLeftColor: who?.color || '#c7c4c4' }}
                    onClick={() => openTask(t.id)}
                    onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); setDrag(t.id) }}
                    onDragEnd={() => { setDrag(null); setOver(null) }}
                    title={t.title}>
                    {t.completed && <Icon name="check" size={11} stroke={3} />}
                    <span className="ellipsis">{t.title || '(無題)'}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      <p className="hint">空いているところをダブルクリックでタスク追加 · ドラッグで期限を変更</p>
    </div>
  )
}
