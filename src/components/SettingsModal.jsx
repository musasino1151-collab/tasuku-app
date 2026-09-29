import { useState } from 'react'
import { useStore } from '../store'
import { COLORS } from '../lib/utils'
import { Avatar, Modal, useMembers } from './common'

export default function SettingsModal({ onClose }) {
  const { me, actions, notify } = useStore()
  const members = useMembers()
  const [name, setName] = useState(me.name)
  const [pw, setPw] = useState('')

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
