import { useEffect, useRef, useState } from 'react'
import { useStore, MAX_FILE_MB } from '../store'
import { formatTime } from '../lib/utils'
import Icon from './Icon'
import { setShrinkEnabled, shrinkEnabled } from '../lib/files'

export function formatSize(n) {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

const isImage = a => /^image\/(png|jpe?g|gif|webp|svg\+xml|bmp)$/.test(a.mime)

function extLabel(name) {
  const m = name.match(/\.([A-Za-z0-9]{1,5})$/)
  return m ? m[1].toUpperCase() : 'FILE'
}
function extColor(name) {
  const e = extLabel(name)
  if (['PDF'].includes(e)) return '#e5484d'
  if (['XLS', 'XLSX', 'CSV'].includes(e)) return '#30a46c'
  if (['DOC', 'DOCX'].includes(e)) return '#3e63dd'
  if (['PPT', 'PPTX', 'KEY'].includes(e)) return '#f76b15'
  if (['ZIP', 'RAR', '7Z'].includes(e)) return '#8e8c99'
  return '#6d6e6f'
}

// 画像のサムネイル（署名付きURLを取得して表示）
function Thumb({ att }) {
  const { actions } = useStore()
  const [url, setUrl] = useState(att._localUrl || null)
  useEffect(() => {
    let alive = true
    if (!url && !att._uploading) actions.fileUrl(att).then(u => { if (alive) setUrl(u) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.id, att._uploading])
  return url ? <img src={url} alt="" className="att-thumb-img" loading="lazy" /> : <span className="att-thumb-ph" />
}

export default function Attachments({ taskId }) {
  const { state, actions } = useStore()
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [shrink, setShrink] = useState(shrinkEnabled)
  useEffect(() => {
    if (!preview) return
    const f = e => { if (e.key === 'Escape') { e.stopPropagation(); setPreview(null) } }
    window.addEventListener('keydown', f, true)
    return () => window.removeEventListener('keydown', f, true)
  }, [preview])
  const list = Object.values(state.attachments)
    .filter(a => a.task_id === taskId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const open = async (att, download = false) => {
    if (att._uploading) return
    if (!download && isImage(att)) {
      const url = await actions.fileUrl(att)
      if (url) setPreview({ url, name: att.name })
      return
    }
    // 先にタブを開いておく（ポップアップブロック対策）
    const w = download ? null : window.open('', '_blank')
    const url = await actions.fileUrl(att, download)
    if (!url) { w?.close(); return }
    if (w) w.location.href = url
    else {
      const a = document.createElement('a')
      a.href = url
      a.download = att.name
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  return (
    <div className="block">
      <div className="block-label">
        添付ファイル {list.length > 0 && <span className="count">{list.length}</span>}
        <button type="button" className="link-btn ml-auto" onClick={() => inputRef.current?.click()}>
          <Icon name="plus" size={12} /> ファイルを追加
        </button>
        <input ref={inputRef} type="file" multiple hidden
          onChange={e => { if (e.target.files.length) actions.uploadFiles(taskId, e.target.files); e.target.value = '' }} />
      </div>

      {list.length === 0 ? (
        <button type="button" className="att-empty" onClick={() => inputRef.current?.click()}>
          <Icon name="attach" size={16} />
          <span>ここにファイルをドラッグ、またはクリックして選択（1ファイル {MAX_FILE_MB}MB まで）<br />
            <span className="muted small">画像はコピーして Ctrl+V でも貼り付けられます</span></span>
        </button>
      ) : (
        <div className="att-grid">
          {list.map(att => {
            const who = state.profiles[att.uploaded_by]
            return (
              <div key={att.id} className={'att' + (att._uploading ? ' uploading' : '')} title={att.name}>
                <button type="button" className="att-thumb" onClick={() => open(att)}>
                  {isImage(att)
                    ? <Thumb att={att} />
                    : <span className="att-ext" style={{ background: extColor(att.name) }}>{extLabel(att.name)}</span>}
                  {att._uploading && <span className="att-spin"><span className="spinner spinner-sm" /></span>}
                </button>
                <div className="att-info">
                  <button type="button" className="att-name ellipsis" onClick={() => open(att)}>{att.name}</button>
                  <div className="att-meta ellipsis">
                    {att._uploading ? 'アップロード中…' : `${formatSize(att.size)} · ${who?.name || ''} · ${formatTime(att.created_at)}`}
                  </div>
                </div>
                {!att._uploading && (
                  <div className="att-actions">
                    <button type="button" className="icon-btn icon-btn-sm" title="ダウンロード" onClick={() => open(att, true)}>
                      <Icon name="download" size={14} />
                    </button>
                    <button type="button" className="icon-btn icon-btn-sm" title="削除"
                      onClick={() => { if (confirm(`「${att.name}」を削除しますか？`)) actions.deleteAttachment(att.id) }}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <label className="toggle att-shrink" title="JPEG/WebP写真を長辺2560px・画質85%に縮小して保存します。画面で見る分には元の画質とほぼ見分けがつきません。印刷用などで元データが必要なときはオフにしてください。">
        <input type="checkbox" checked={shrink} onChange={e => { setShrink(e.target.checked); setShrinkEnabled(e.target.checked) }} />
        写真を自動で軽くする（長辺2560px・画質85%）
      </label>

      {preview && (
        <div className="lightbox" onClick={() => setPreview(null)} role="dialog">
          <img src={preview.url} alt={preview.name} onClick={e => e.stopPropagation()} />
          <div className="lightbox-bar" onClick={e => e.stopPropagation()}>
            <span className="ellipsis">{preview.name}</span>
            <a className="btn btn-sm" href={preview.url} target="_blank" rel="noreferrer">新しいタブで開く</a>
            <button type="button" className="btn btn-sm" onClick={() => setPreview(null)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  )
}
