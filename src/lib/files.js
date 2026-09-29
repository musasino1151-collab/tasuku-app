import { supabase } from './supabase'

// ------------------------------------------------------------
// 画像の自動縮小
//   対象：JPEG / WebP で 1MB を超えるもの、または長辺が 2560px を超えるもの
//   方法：長辺 2560px（WQHD 相当）まで縮小し、JPEG 品質 85% で保存
//   PNG（スクリーンショット等）は文字がにじむのを避けるためそのまま
// ------------------------------------------------------------
const MAX_EDGE = 2560
const QUALITY = 0.85

export async function shrinkImage(file) {
  if (!/^image\/(jpeg|webp)$/.test(file.type)) return file
  let bmp
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  const { width, height } = bmp
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  if (scale === 1 && file.size <= 1024 * 1024) { bmp.close?.(); return file }
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', QUALITY))
  if (!blob || blob.size >= file.size) return file
  const name = file.name.replace(/\.(jpe?g|webp)$/i, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
}

export const shrinkEnabled = () => {
  try { return localStorage.getItem('shrinkImages') !== '0' } catch { return true }
}
export const setShrinkEnabled = on => {
  try { localStorage.setItem('shrinkImages', on ? '1' : '0') } catch { /* 保存できなくても動作に支障なし */ }
}

// ------------------------------------------------------------
// Cloudflare R2（Worker の /api/files/*）
// ------------------------------------------------------------
let r2Ready = null
export async function r2Available() {
  if (r2Ready !== null) return r2Ready
  try {
    const r = await fetch('/api/files/health')
    r2Ready = r.ok && (await r.json()).r2 === true
  } catch {
    r2Ready = false
  }
  return r2Ready
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  return {
    authorization: 'Bearer ' + (data.session?.access_token || ''),
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

export async function r2Upload(key, file) {
  const r = await fetch('/api/files/upload?key=' + encodeURIComponent(key), {
    method: 'PUT',
    headers: { ...(await authHeaders()), 'content-type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'アップロードに失敗しました')
}

// 60 分有効の URL をまとめて発行（サムネイル用のキャッシュつき）
const urlCache = new Map()
export async function r2Url(key, name, download = false) {
  const ck = key + '|' + (download ? 1 : 0)
  const hit = urlCache.get(ck)
  if (hit && hit.until > Date.now()) return hit.url
  const r = await fetch('/api/files/sign', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'content-type': 'application/json' },
    body: JSON.stringify({ keys: [key], names: { [key]: name }, download }),
  })
  if (!r.ok) throw new Error('ファイルを開けませんでした')
  const url = (await r.json()).urls[key]
  urlCache.set(ck, { url, until: Date.now() + 50 * 60 * 1000 })
  return url
}

export async function r2Delete(keys) {
  if (!keys.length) return
  await fetch('/api/files/delete', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'content-type': 'application/json' },
    body: JSON.stringify({ keys }),
  })
}
