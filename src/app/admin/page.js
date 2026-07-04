'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/layout'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'

export default function AdminPage() {
  const { user, role, loading, appEnabled, setAppEnabled } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (!loading && (!user || role !== 'admin')) router.replace('/login')
  }, [user, role, loading, router])

  useEffect(() => {
    if (role === 'admin') fetchUsers()
  }, [role])

  async function fetchUsers() {
    const { data } = await supabase.from('user_roles').select('*').order('created_at', { ascending: true })
    setUsers(data || [])
  }

  async function toggleApp() {
    setToggling(true)
    const newVal = !appEnabled
    await supabase.from('app_config').update({ value: newVal, updated_at: new Date().toISOString() }).eq('key', 'app_enabled')
    setAppEnabled(newVal)
    setToggling(false)
  }

  async function changeRole(userId, newRole) {
    await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId)
    fetchUsers()
  }

  async function removeUser(userId) {
    await supabase.from('user_roles').delete().eq('user_id', userId)
    fetchUsers()
  }

  if (loading || role !== 'admin') return null

  const C = {
    bg: '#eef2f7', white: '#ffffff', header: '#003c71', accent: '#0078d4',
    border: '#c8d6e5', borderLight: '#dfe6ed', text: '#1a2b3c', textMuted: '#5a6f82',
    gridBg: '#f7f9fc', green: '#0b8043', greenBg: '#e6f4ea', red: '#c5221f', redBg: '#fce8e6',
    orange: '#e37400', orangeBg: '#fef3e0'
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar />
      <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>

        {/* App Toggle */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ background: C.header, color: '#fff', padding: '12px 20px', fontSize: 14, fontWeight: 600 }}>Control de Aplicación</div>
          <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Estado de la aplicación</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                {appEnabled ? 'La aplicación está activa. Los usuarios pueden acceder.' : 'La aplicación está desactivada. Nadie puede acceder excepto tú.'}
              </div>
            </div>
            <button onClick={toggleApp} disabled={toggling}
              style={{
                padding: '10px 28px', borderRadius: 4, border: 'none', fontSize: 14, fontWeight: 700,
                background: appEnabled ? C.red : C.green, color: '#fff',
                opacity: toggling ? 0.6 : 1
              }}>
              {appEnabled ? '⏸ Desactivar' : '▶ Activar'}
            </button>
          </div>
          <div style={{ padding: '12px 24px', background: appEnabled ? C.greenBg : C.redBg, borderTop: `1px solid ${C.borderLight}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: appEnabled ? C.green : C.red }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: appEnabled ? C.green : C.red }}>
              {appEnabled ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Users Table */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ background: C.header, color: '#fff', padding: '12px 20px', fontSize: 14, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Gestión de Usuarios</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{users.length} usuarios</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.gridBg }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Email</th>
                <th style={{ textAlign: 'center', padding: '10px 16px', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Rol</th>
                <th style={{ textAlign: 'center', padding: '10px 16px', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Fecha Alta</th>
                <th style={{ textAlign: 'center', padding: '10px 16px', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const isMe = u.user_id === user?.id
                return (
                  <tr key={u.user_id} style={{ background: i % 2 === 0 ? C.white : C.gridBg, borderBottom: `1px solid ${C.borderLight}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: isMe ? 700 : 400 }}>
                      {u.email} {isMe && <span style={{ fontSize: 10, color: C.accent, marginLeft: 6 }}>(tú)</span>}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                      {isMe ? (
                        <span style={{ padding: '3px 12px', borderRadius: 3, background: C.greenBg, color: C.green, fontWeight: 700, fontSize: 12 }}>ADMIN</span>
                      ) : (
                        <select value={u.role} onChange={e => changeRole(u.user_id, e.target.value)}
                          style={{ padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 12, background: C.white }}>
                          <option value="pending">Pendiente</option>
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 16px', color: C.textMuted, fontSize: 12 }}>
                      {new Date(u.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                      {!isMe && (
                        <button onClick={() => removeUser(u.user_id)}
                          style={{ padding: '4px 12px', border: `1px solid ${C.red}`, borderRadius: 3, background: C.redBg, color: C.red, fontSize: 11, fontWeight: 600 }}>
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
