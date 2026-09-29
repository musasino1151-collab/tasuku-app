// Cloudflare Worker：画面（静的ファイル）の配信 ＋ 添付ファイル API（R2）
//
// 必要な設定（wrangler.jsonc / Cloudflare 管理画面）
//   R2 バインディング  FILES             → R2 バケット「team-tasuku-files」
//   変数              SUPABASE_URL      → https://<ref>.supabase.co
//   シークレット        FILE_SIGNING_SECRET → 長いランダム文字列（署名付き URL 用）

const MAX_BYTES = 50 * 1024 * 1024
const KEY_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,10}$/
const URL_TTL = 60 * 60 // 署名付き URL の有効期限（秒）

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
    try {
      return await api(req, env, url)
    } catch (e) {
      console.error(e)
      return json({ error: String(e?.message || e) }, 500)
    }
  },
}

async function api(req, env, url) {
  const path = url.pathname
  const ready = Boolean(env.FILES && env.FILE_SIGNING_SECRET && env.SUPABASE_URL)

  if (path === '/api/files/health') return json({ r2: ready })

  // 署名付き URL でのダウンロード／表示（<img> から直接読めるようにログイン確認は署名で代替）
  if (path === '/api/files/get' && req.method === 'GET') {
    if (!ready) return json({ error: 'r2 not configured' }, 503)
    const key = url.searchParams.get('key') || ''
    const exp = Number(url.searchParams.get('exp') || 0)
    const name = url.searchParams.get('name') || ''
    const dl = url.searchParams.get('dl') === '1'
    const sig = url.searchParams.get('sig') || ''
    if (!KEY_RE.test(key) || exp < Date.now() / 1000) return new Response('Link expired', { status: 403 })
    const expected = await hmac(env.FILE_SIGNING_SECRET, `${key}|${exp}|${name}|${dl ? 1 : 0}`)
    if (!timingSafeEqual(sig, expected)) return new Response('Forbidden', { status: 403 })
    const obj = await env.FILES.get(key)
    if (!obj) return new Response('Not found', { status: 404 })
    const headers = new Headers()
    obj.writeHttpMetadata(headers)
    headers.set('etag', obj.httpEtag)
    headers.set('cache-control', 'private, max-age=3600')
    headers.set('x-content-type-options', 'nosniff')
    const safeName = name || key.split('/').pop()
    // 表示してよい種類以外は必ずダウンロード扱いにする（HTML などをこのドメインで開かせない）
    const inlineOk = /^(image\/(png|jpe?g|gif|webp|bmp)|application\/pdf|text\/plain)$/.test(headers.get('content-type') || '')
    headers.set('content-disposition',
      `${dl || !inlineOk ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(safeName)}`)
    return new Response(obj.body, { headers })
  }

  // ここから下はログイン必須
  if (!ready) return json({ error: 'r2 not configured' }, 503)
  const user = await getUser(req, env)
  if (!user) return json({ error: 'unauthorized' }, 401)

  if (path === '/api/files/upload' && req.method === 'PUT') {
    const key = url.searchParams.get('key') || ''
    if (!KEY_RE.test(key)) return json({ error: 'bad key' }, 400)
    const len = Number(req.headers.get('content-length') || 0)
    if (!len) return json({ error: 'empty file' }, 400)
    if (len > MAX_BYTES) return json({ error: 'file too large' }, 413)
    const type = req.headers.get('content-type') || 'application/octet-stream'
    await env.FILES.put(key, req.body, {
      httpMetadata: { contentType: type },
      customMetadata: { uploadedBy: user.id },
    })
    return json({ ok: true, key })
  }

  if (path === '/api/files/sign' && req.method === 'POST') {
    const { keys = [], download = false, names = {} } = await req.json()
    const exp = Math.floor(Date.now() / 1000) + URL_TTL
    const out = {}
    for (const key of keys.slice(0, 100)) {
      if (!KEY_RE.test(key)) continue
      const name = names[key] || ''
      const dl = download ? 1 : 0
      const sig = await hmac(env.FILE_SIGNING_SECRET, `${key}|${exp}|${name}|${dl}`)
      const q = new URLSearchParams({ key, exp: String(exp), name, dl: String(dl), sig })
      out[key] = `/api/files/get?${q}`
    }
    return json({ urls: out })
  }

  if (path === '/api/files/delete' && req.method === 'POST') {
    const { keys = [] } = await req.json()
    const valid = keys.filter(k => KEY_RE.test(k)).slice(0, 1000)
    if (valid.length) await env.FILES.delete(valid)
    return json({ ok: true, deleted: valid.length })
  }

  return json({ error: 'not found' }, 404)
}

// Supabase にトークンを問い合わせてログイン中のユーザーか確認する
async function getUser(req, env) {
  const auth = req.headers.get('authorization')
  const apikey = req.headers.get('apikey')
  if (!auth || !apikey) return null
  const r = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/user', {
    headers: { authorization: auth, apikey },
  })
  if (!r.ok) return null
  const u = await r.json()
  return u?.id ? u : null
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
