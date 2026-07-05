'use client'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/layout'

export default function Navbar() {
  const { user, role, logoUrl } = useAuth()
  const router = useRouter()
  const path = usePathname()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tabs = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/upload', label: 'Subir Datos' },
    { href: '/agent', label: 'Agente IA' },
    ...(role === 'admin' ? [{ href: '/admin', label: 'Usuarios' }, { href: '/settings', label: 'Parametrización' }] : []),
  ]

  return (
    <div style={{ background: 'linear-gradient(135deg, #003c71, #00508f)', color: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="logo" style={{ height: 28, borderRadius: 3, background: '#fff', padding: 2 }} />
          ) : (
            <div style={{ width: 28, height: 28, background: '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#003c71', fontSize: 12 }}>IF</div>
          )}
          <span style={{ fontSize: 14, fontWeight: 600 }}>Infinnis Forecast</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {tabs.map(t => (
            <button key={t.href} onClick={() => router.push(t.href)}
              style={{
                padding: '6px 14px', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 500,
                background: path === t.href ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: '#fff', borderBottom: path === t.href ? '2px solid #fff' : '2px solid transparent'
              }}>
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
