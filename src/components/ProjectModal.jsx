import { useState } from 'react'
import { useStore } from '../store'
import { COLORS } from '../lib/utils'
import { Modal } from './common'

export default function ProjectModal({ project, onClose, go }) {
  const { actions } = useStore()
  const [name, setName] = useState(project?.name || '')
  const [color, setColor] = useState(project?.color || COLORS[8])
  const [description, setDescription] = useState(project?.description || '')

  const submit = e => {
    e?.preventDefault()
    if (!name.trim()) return
    if (project) actions.updateProject(project.id, { name: name.trim(), color, description })
    else {
      const p = actions.createProject({ name: name.trim(), color, description })
      go({ view: 'project', id: p.id, tab: 'list', task: null })
    }
    onClose()
  }

  return (
    <Modal title={project ? 'プロジェクトを編集' : '新しいプロジェクト'} onClose={onClose}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>キャンセル</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={!name.trim()}>{project ? '保存' : '作成'}</button>
      </>}>
      <form onSubmit={submit}>
        <label className="field">
          <span>プロジェクト名</span>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="例：ドバイ輸出" />
        </label>
        <div className="field">
          <span>カラー</span>
          <div className="swatches">
            {COLORS.map(c => (
              <button key={c} type="button" className={'swatch' + (c === color ? ' on' : '')} style={{ background: c }}
                onClick={() => setColor(c)} aria-label={c} />
            ))}
          </div>
        </div>
        <label className="field">
          <span>説明（任意）</span>
          <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="このプロジェクトの目的やメモ" />
        </label>
        {!project && <p className="small muted">「未着手」「進行中」「確認待ち」の 3 セクションが自動で作られます（あとで変更できます）。</p>}
      </form>
    </Modal>
  )
}
