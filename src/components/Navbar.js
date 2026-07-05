'use client'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/layout'

export default function Navbar() {
  const { user, role, branding } = useAuth()
  const router = useRouter()
  const path = usePathname()

  async function logout() { await supabase.auth.signOut(); router.push('/login') }

  const tabs = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/upload', label: 'Cargar Ventas' },
    { href: '/agent', label: 'Agente IA' },
  ]
  if (role === 'admin') {
    tabs.push({ href: '/admin', label: 'Usuarios' })
    tabs.push({ href: '/settings', label: 'Parametrización' })
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #003c71, #00508f)', color: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {branding?.logo_url
          ? <img src={branding.logo_url} alt="logo" style={{ height: 30, maxWidth: 120, objectFit: 'contain', background: '#fff', borderRadius: 4, padding: 2 }} />
          : <div style={{ width: 30, height: 30, background: '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#003c71', fontSize: 13 }}>IF</div>}
        <span style={{ fontSize: 15, fontWeight: 600 }}>{branding?.company_name || 'Infinnis'} Forecast</span>
        <div style={{ display: 'flex', gap: 3, marginLeft: 20 }}>
          {tabs.map(t => (
            <button key={t.href} onClick={() => router.push(t.href)}
              style={{ padding: '6px 14px', background: path === t.href ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, color: '#fff', fontSize: 12, fontWeight: path === t.href ? 700 : 500 }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>{user?.email}</span>
        <span style={{ fontSize: 10, padding: '2px 8px', background: role === 'admin' ? '#0b8043' : '#0078d4', borderRadius: 3, fontWeight: 600 }}>{role?.toUpperCase()}</span>
        <button onClick={logout} style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 3, color: '#fff', fontSize: 12 }}>Salir</button>
      </div>
    </div>
  )
}
