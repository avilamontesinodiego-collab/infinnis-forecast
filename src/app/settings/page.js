'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/layout'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'

const C = { header:'#003c71', accent:'#0078d4', border:'#c8d6e5', borderLight:'#dfe6ed', text:'#1a2b3c', textMuted:'#5a6f82', gridBg:'#f7f9fc', green:'#0b8043', greenBg:'#e6f4ea', red:'#c5221f', redBg:'#fce8e6', white:'#fff' }

export default function SettingsPage() {
  const { user, role, loading, branding, setBranding, refreshConfig } = useAuth()
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { if (!loading && (!user || role !== 'admin')) router.replace('/login') }, [user, role, loading, router])
  useEffect(() => { if (branding) { setCompanyName(branding.company_name || ''); setLogoUrl(branding.logo_url || '') } }, [branding])

  if (loading || role !== 'admin') return null

  async function handleLogo(e) {
    setErr(''); setMsg('')
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      setLogoUrl(data.publicUrl)
      setMsg('Logo subido. Pulsa Guardar para aplicarlo.')
    } catch (e) { setErr('Error subiendo logo: ' + e.message) }
    setUploading(false)
  }

  async function save() {
    setErr(''); setMsg('')
    const value = { logo_url: logoUrl, company_name: companyName || 'Infinnis' }
    const { error } = await supabase.from('app_config').update({ value, updated_at: new Date().toISOString() }).eq('key', 'branding')
    if (error) { setErr('Error guardando: ' + error.message); return }
    setBranding(value)
    await refreshConfig?.()
    setMsg('✓ Parametrización guardada.')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#eef2f7' }}>
      <Navbar />
      <div style={{ padding: '24px 32px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ background: C.header, color: '#fff', padding: '12px 20px', fontSize: 14, fontWeight: 600 }}>Parametrización (solo administrador)</div>
          <div style={{ padding: 24 }}>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, display: 'block', marginBottom: 8 }}>Nombre de la empresa</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                style={{ width: '100%', maxWidth: 360, padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }}
                placeholder="Infinnis" />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, display: 'block', marginBottom: 8 }}>Logo de la empresa</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 160, height: 80, border: `1px dashed ${C.border}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.gridBg }}>
                  {logoUrl ? <img src={logoUrl} alt="logo" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} /> : <span style={{ fontSize: 12, color: C.textMuted }}>Sin logo</span>}
                </div>
                <label style={{ display: 'inline-block', padding: '9px 18px', background: C.accent, color: '#fff', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {uploading ? 'Subiendo...' : 'Subir logo'}
                  <input type="file" accept="image/*" onChange={handleLogo} disabled={uploading} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {msg && <div style={{ background: C.greenBg, border: `1px solid ${C.green}`, borderRadius: 4, padding: '10px 14px', fontSize: 13, color: C.green, marginBottom: 16 }}>{msg}</div>}
            {err && <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 4, padding: '10px 14px', fontSize: 13, color: C.red, marginBottom: 16 }}>{err}</div>}

            <button onClick={save} style={{ padding: '10px 28px', background: C.green, color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 700 }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
