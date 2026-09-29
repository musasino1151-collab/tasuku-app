import { useEffect, useState } from 'react'
import { supabase, DEMO, CONFIGURED } from './lib/supabase'
import { StoreProvider } from './store'
import Login from './components/Login'
import Shell from './components/Shell'

export default function App() {
  const [session, setSession] = useState(DEMO ? { user: { id: 'demo-me', email: 'you@example.com' } } : undefined)

  useEffect(() => {
    if (DEMO || !supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!CONFIGURED) {
    return (
      <div className="center-screen">
        <div className="auth-card">
          <h1>設定が必要です</h1>
          <p className="muted">VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を環境変数に設定してください（README 参照）。</p>
        </div>
      </div>
    )
  }
  if (session === undefined) return <div className="center-screen"><div className="spinner" /></div>
  if (!session) return <Login />
  return (
    <StoreProvider key={session.user.id} session={session}>
      <Shell />
    </StoreProvider>
  )
}
