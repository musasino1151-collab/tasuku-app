import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { Avatar, useMembers } from './common'

// 本文中の「@名前」から、実際にメンションされたメンバーの ID を取り出す
export function extractMentions(body, members) {
  const ids = new Set()
  // 長い名前から順に照合（「山田」と「山田太郎」のような重なり対策）
  for (const m of [...members].sort((a, b) => b.name.length - a.name.length)) {
    if (body.includes('@' + m.name)) ids.add(m.id)
  }
  return [...ids]
}

// コメント本文：@名前 を強調表示
export function CommentBody({ body, mentions = [] }) {
  const { state, meId } = useStore()
  const names = (mentions || []).map(id => state.profiles[id]).filter(Boolean)
    .sort((a, b) => b.name.length - a.name.length)
  if (!names.length) return <div className="comment-body">{body}</div>
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp('(' + names.map(n => '@' + esc(n.name)).join('|') + ')', 'g')
  return (
    <div className="comment-body">
      {body.split(re).map((part, i) => {
        const who = names.find(n => '@' + n.name === part)
        return who
          ? <span key={i} className={'mention' + (who.id === meId ? ' me' : '')}>{part}</span>
          : <span key={i}>{part}</span>
      })}
    </div>
  )
}

// @ を打つと候補が出るコメント入力欄
export function CommentComposer({ onSend }) {
  const { state, meId } = useStore()
  const members = useMembers()
  const [text, setText] = useState('')
  const [query, setQuery] = useState(null) // { start, q } — @ の位置と入力中の文字
  const [idx, setIdx] = useState(0)
  const ref = useRef(null)

  const candidates = useMemo(() => {
    if (!query) return []
    const q = query.q.toLowerCase()
    return members
      .filter(m => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .sort((a, b) => (a.id === meId) - (b.id === meId))
      .slice(0, 8)
  }, [query, members, meId])

  const detect = (value, caret) => {
    const before = value.slice(0, caret)
    const m = before.match(/(^|[\s　])@([^\s　@]{0,20})$/)
    if (m) {
      setQuery({ start: caret - m[2].length - 1, q: m[2] })
      setIdx(0)
    } else setQuery(null)
  }

  const pick = member => {
    const el = ref.current
    const caret = el.selectionStart
    const next = text.slice(0, query.start) + '@' + member.name + ' ' + text.slice(caret)
    const pos = query.start + member.name.length + 2
    setText(next)
    setQuery(null)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos) })
  }

  const insertAt = () => {
    const el = ref.current
    const caret = el.selectionStart ?? text.length
    const needSpace = caret > 0 && !/[\s　]/.test(text[caret - 1])
    const next = text.slice(0, caret) + (needSpace ? ' @' : '@') + text.slice(caret)
    const pos = caret + (needSpace ? 2 : 1)
    setText(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos); detect(next, pos) })
  }

  const send = () => {
    const body = text.trim()
    if (!body) return
    onSend(body, extractMentions(body, members))
    setText('')
    setQuery(null)
  }

  const mentioned = extractMentions(text, members).map(id => state.profiles[id]).filter(Boolean)

  return (
    <div className="composer-box">
      {query && candidates.length > 0 && (
        <div className="mention-pop" role="listbox">
          <div className="mention-pop-head">メンションする人</div>
          {candidates.map((m, i) => (
            <button key={m.id} type="button" className={'picker-item' + (i === idx ? ' hover' : '')}
              onMouseDown={e => { e.preventDefault(); pick(m) }} onMouseEnter={() => setIdx(i)}>
              <Avatar user={m} size={22} /> <span>{m.name}</span>
              <span className="muted small ellipsis picker-sub">{m.email}</span>
            </button>
          ))}
        </div>
      )}
      <textarea ref={ref} value={text} rows={text.includes('\n') ? 4 : 2}
        placeholder="コメントを書く…　@ で人をメンション（⌘/Ctrl + Enter で送信）"
        onChange={e => { setText(e.target.value); detect(e.target.value, e.target.selectionStart) }}
        onClick={e => detect(text, e.target.selectionStart)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onKeyDown={e => {
          if (query && candidates.length) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => (i + 1) % candidates.length); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => (i - 1 + candidates.length) % candidates.length); return }
            if ((e.key === 'Enter' || e.key === 'Tab') && !e.nativeEvent.isComposing) { e.preventDefault(); pick(candidates[idx]); return }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setQuery(null); return }
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() }
        }} />
      <div className="composer-foot">
        <button type="button" className="icon-btn icon-btn-sm at-btn" onClick={insertAt} title="メンション">@</button>
        <span className="small muted ellipsis composer-note">
          {mentioned.length
            ? <>通知先：{mentioned.map(m => m.name).join('、')} ＋ 担当者・作成者</>
            : '担当者・作成者・過去のコメント投稿者に通知されます'}
        </span>
        <button type="button" className="btn btn-primary btn-sm" disabled={!text.trim()} onClick={send}>送信</button>
      </div>
    </div>
  )
}
