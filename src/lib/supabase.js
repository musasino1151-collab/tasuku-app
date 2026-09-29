import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const DEMO = import.meta.env.VITE_DEMO === '1'
export const CONFIGURED = DEMO || Boolean(url && key)
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Team Tasks'
export const supabase = !DEMO && url && key ? createClient(url, key) : null

document.title = APP_NAME
