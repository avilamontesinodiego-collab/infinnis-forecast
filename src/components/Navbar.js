'use client'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/layout'

export default function Navbar() {
  const { user, role } = useAuth()
  const router = useRouter()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #003c71, #00508f)', color: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 30, height: 30, background: '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#003c71', fontSize: 13 }}>IF</div>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Infinnis Forecast</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 24 }}>
          <button onClick={() => router.push('/dashboard')}
            style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, color: '#fff', fontSize: 12, fontWeight: 500 }}>
            Dashboard
          </button>
          {role === 'admin' && (
            <button onClick={() => router.push('/admin')}
              style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, color: '#fff', fontSize: 12, fontWeight: 500 }}>
              Admin
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>{user?.email}</span>
        <span style={{ fontSize: 10, padding: '2px 8px', background: role === 'admin' ? '#0b8043' : '#0078d4', borderRadius: 3, fontWeight: 600 }}>{role?.toUpperCase()}</span>
        <button onClick={logout}
          style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 3, color: '#fff', fontSize: 12 }}>
          Salir
        </button>
      </div>
    </div>
  )
}
