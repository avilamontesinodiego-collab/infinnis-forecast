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
  const [branding, setBranding] = useState({ logo_url: '', company_name: 'Infinnis' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
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
    const { data } = await supabase.from('app_config').select('key,value').in('key', ['app_enabled', 'branding'])
    if (data) {
      for (const row of data) {
        if (row.key === 'app_enabled') setAppEnabled(row.value === true)
        if (row.key === 'branding') setBranding({ logo_url: row.value?.logo_url || '', company_name: row.value?.company_name || 'Infinnis' })
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, appEnabled, setAppEnabled, branding, setBranding, refreshConfig: fetchConfig }}>
      {children}
    </AuthContext.Provider>
  )
}

export default function RootLayout({ children }) {
  return (
    <html lang="es"><body><AuthProvider>{children}</AuthProvider></body></html>
  )
}
