'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login')
  const [message, setMessage] = useState('')
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/dashboard')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Cuenta creada. Espera a que el administrador te active el acceso.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #003c71 0%, #00508f 50%, #0078d4 100%)' }}>
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', width: 400, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#003c71', padding: '32px 40px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: '#fff', borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#003c71', fontSize: 24, marginBottom: 12 }}>IF</div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 600, margin: 0 }}>Infinnis Forecast</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 }}>Motor Estadístico de Pronóstico</p>
        </div>

        {/* Form */}
        <div style={{ padding: '32px 40px' }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setMessage('') }}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, border: 'none',
                  borderBottom: `2px solid ${mode === m ? '#0078d4' : '#dfe6ed'}`,
                  color: mode === m ? '#0078d4' : '#8a9bac',
                  background: 'none'
                }}>
                {m === 'login' ? 'Iniciar Sesión' : 'Registrarse'}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: '#fce8e6', border: '1px solid #c5221f', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#c5221f' }}>{error}</div>
          )}
          {message && (
            <div style={{ background: '#e6f4ea', border: '1px solid #0b8043', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#0b8043' }}>{message}</div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#5a6f82', fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #c8d6e5', borderRadius: 4, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              placeholder="tu@email.com" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, color: '#5a6f82', fontWeight: 600, display: 'block', marginBottom: 6 }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #c8d6e5', borderRadius: 4, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              placeholder="••••••••" />
          </div>
          <button onClick={handleSubmit}
            style={{
              width: '100%', padding: '12px 0', background: '#0078d4', color: '#fff', border: 'none',
              borderRadius: 4, fontSize: 14, fontWeight: 600
            }}>
            {mode === 'login' ? 'Acceder' : 'Crear Cuenta'}
          </button>
        </div>

        <div style={{ padding: '16px 40px', borderTop: '1px solid #dfe6ed', textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: '#8a9bac' }}>Infinnis © 2026</span>
        </div>
      </div>
    </div>
  )
}
