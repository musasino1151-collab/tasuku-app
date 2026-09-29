import { useState } from 'react'
import { supabase, APP_NAME } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'メールアドレスかパスワードが違います' : error.message)
  }

  return (
    <div className="center-screen login-bg">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand brand-lg"><span className="brand-mark" />{APP_NAME}</div>
        <label className="field">
          <span>メールアドレス</span>
          <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>パスワード</span>
          <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'ログイン中…' : 'ログイン'}</button>
        <p className="muted small">アカウントは管理者が発行します。</p>
      </form>
    </div>
  )
}
