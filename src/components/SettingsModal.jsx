import { useEffect, useState } from 'react'
import { formatSize } from './Attachments'
import { useStore } from '../store'
import { COLORS } from '../lib/utils'
import { Avatar, Modal, useMembers } from './common'

export default function SettingsModal({ onClose }) {
  const { me, actions, notify } = useStore()
  const members = useMembers()
  const [name, setName] = useState(me.name)
  const [pw, setPw] = useState('')
  const [usage, setUsage] = useState(undefined)
  useEffect(() => { actions.storageUsage().then(setUsage) }, [actions])

  const saveName = () => { if (name.trim() && name.trim() !== me.name) { actions.updateProfile({ name: name.trim() }); notify('表示名を保存しました') } }
  const savePw = async () => {
    if (pw.length < 8) return notify('パスワードは 8 文字以上にしてください')
    if (await actions.changePassword(pw)) { setPw(''); notify('パスワードを変更しました') }
  }

  return (
    <Modal title="設定" onClose={onClose} width={520}>
      <div className="settings">
        <section>
          <h3>プロフィール</h3>
          <div className="row-gap">
            <Avatar user={{ ...me, name }} size={44} />
            <label className="field grow">
              <span>表示名</span>
              <input value={name} onChange={e => setName(e.target.value)} onBlur={saveName}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.target.blur() }} />
            </label>
          </div>
          <div className="field">
            <span>アイコンの色</span>
            <div className="swatches">
              {COLORS.map(c => (
                <button key={c} type="button" className={'swatch' + (c === me.color ? ' on' : '')} style={{ background: c }}
                  onClick={() => actions.updateProfile({ color: c })} aria-label={c} />
              ))}
            </div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={me.email_notify !== false} onChange={e => actions.updateProfile({ email_notify: e.target.checked })} />
            メール通知を受け取る（{me.email}）
          </label>
        </section>

        <section>
          <h3>パスワード変更</h3>
          <div className="row-gap">
            <input type="password" className="input grow" value={pw} placeholder="新しいパスワード（8 文字以上）" autoComplete="new-password"
              onChange={e => setPw(e.target.value)} />
            <button type="button" className="btn" onClick={savePw} disabled={!pw}>変更</button>
          </div>
        </section>

        <section>
          <h3>添付ファイルの使用容量</h3>
          {usage === undefined ? <p className="muted small">読み込み中…</p> : usage === null ? (
            <p className="muted small">集計できませんでした（データベースの更新 005 が未実行の可能性があります）</p>
          ) : (() => {
            const free = usage.r2 ? 10 * 1024 ** 3 : 1024 ** 3
            const used = usage.r2 ? Number(usage.r2_bytes) : Number(usage.supabase_bytes)
            const pct = Math.min(100, (used / free) * 100)
            return (
              <div className="usage">
                <div className="usage-bar"><div style={{ width: Math.max(pct, 0.5) + '%', background: pct > 80 ? 'var(--red)' : 'var(--blue)' }} /></div>
                <div className="usage-row">
                  <b>{formatSize(used)}</b> <span className="muted">/ 無料枠 {usage.r2 ? '10GB（Cloudflare R2）' : '1GB（Supabase）'} · {pct.toFixed(1)}%</span>
                </div>
                <p className="muted small">
                  ファイル数 {usage.files} 件
                  {usage.r2 && Number(usage.supabase_bytes) > 0 && <> · 切り替え前のファイル {formatSize(Number(usage.supabase_bytes))}（Supabase）</>}
                  {usage.r2 && <><br />10GB を超えても止まりません。超えた分は 1GB あたり月 $0.015（100GB で約 200 円/月）です。</>}
                </p>
              </div>
            )
          })()}
        </section>

        <section>
          <h3>メンバー（{members.length}人）</h3>
          <div className="member-list">
            {members.map(m => (
              <div key={m.id} className="member">
                <Avatar user={m} size={28} />
                <div>
                  <div>{m.name}{m.id === me.id && <span className="muted small">（あなた）</span>}</div>
                  <div className="muted small">{m.email}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="small muted">メンバーの追加は Supabase の Authentication → Users → Add user から行います（README 参照）。</p>
        </section>

        <div className="modal-foot-inline">
          <button type="button" className="btn btn-danger-ghost" onClick={actions.signOut}>ログアウト</button>
        </div>
      </div>
    </Modal>
  )
}
