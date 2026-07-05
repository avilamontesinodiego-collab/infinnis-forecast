'use client'
import './globals.css'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({})
export const useAuth = () => useContext(AuthContext)

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [appEnabled, setAppEnabled] = useState(true)
  const [logoUrl, setLogoUrl] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      else { setRole(null); setLoading(false) }
    })
    fetchConfig()
    return () => subscription.unsubscribe()
  }, [])

  async function fetchRole(userId) {
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).single()
    setRole(data?.role ?? 'pending')
    setLoading(false)
  }

  async function fetchConfig() {
    const { data } = await supabase.from('app_config').select('key,value')
    if (data) {
      const cfg = Object.fromEntries(data.map(r => [r.key, r.value]))
      setAppEnabled(cfg.app_enabled === true)
      if (cfg.logo_url) setLogoUrl(typeof cfg.logo_url === 'string' ? cfg.logo_url : cfg.logo_url?.url || null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, appEnabled, setAppEnabled, logoUrl, setLogoUrl, fetchConfig }}>
      {children}
    </AuthContext.Provider>
  )
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
