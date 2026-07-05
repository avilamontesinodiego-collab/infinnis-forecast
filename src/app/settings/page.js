'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/layout'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'

const C = { bg:'#eef2f7',white:'#ffffff',header:'#003c71',accent:'#0078d4',accentLight:'#cce4f7',border:'#c8d6e5',borderLight:'#dfe6ed',text:'#1a2b3c',textMuted:'#5a6f82',textLight:'#8a9bac',gridBg:'#f7f9fc',green:'#0b8043',greenBg:'#e6f4ea',red:'#c5221f',redBg:'#fce8e6',orange:'#e37400' }

export default function SettingsPage() {
  const { user, role, loading, logoUrl, setLogoUrl, fetchConfig } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [logos, setLogos] = useState([])

  useEffect(() => { if (!loading && (!user || role !== 'admin')) router.replace('/login') }, [user, role, loading, router])
  useEffect(() => { if (role === 'admin') { loadLogos(); loadName() } }, [role])

  async function loadLogos() {
    const { data } = await supabase.storage.from('logos').list('', { limit: 100 })
    if (data) setLogos(data.filter(f => f.name !== '.emptyFolderPlaceholder'))
  }

  async function loadName() {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'company_name').single()
    if (data?.value) setCompanyName(typeof data.value === 'string' ? data.value : data.value?.name || '')
  }

  async function handleLogo(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setStatus('Subiendo logo...')
    const ext = file.name.split('.').pop()
    const path = `logo-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (error) { setStatus(`Error: ${error.message}`); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
    await supabase.from('app_config').upsert({ key: 'logo_url', value: publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setLogoUrl(publicUrl)
    setStatus('✓ Logo actualizado')
    loadLogos()
    if (fetchConfig) fetchConfig()
    setUploading(false)
  }

  async function setAsActive(name) {
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(name)
    await supabase.from('app_config').upsert({ key: 'logo_url', value: publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setLogoUrl(publicUrl)
    setStatus('✓ Logo activado')
    if (fetchConfig) fetchConfig()
  }

  async function deleteLogo(name) {
    await supabase.storage.from('logos').remove([name])
    loadLogos()
    setStatus('Logo eliminado')
  }

  async function saveName() {
    await supabase.from('app_config').upsert({ key: 'company_name', value: companyName, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setStatus('✓ Nombre guardado')
  }

  if (loading || role !== 'admin') return null

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar />
      <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 4 }}>Parametrización</h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Configuración de marca y empresa. Solo visible para administradores.</p>

        {status && (
          <div style={{ background: status.startsWith('✓') ? C.greenBg : status.startsWith('Error') ? C.redBg : C.accentLight, borderRadius: 4, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: status.startsWith('✓') ? C.green : status.startsWith('Error') ? C.red : C.accent, fontWeight: 500 }}>{status}</div>
        )}

        {/* Company name */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ background: C.header, color: '#fff', padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>Nombre de Empresa</div>
          <div style={{ padding: 20, display: 'flex', gap: 10 }}>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Nombre de la empresa cliente"
              style={{ flex: 1, padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, outline: 'none' }} />
            <button onClick={saveName} style={{ padding: '10px 20px', background: C.accent, color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>Guardar</button>
          </div>
        </div>

        {/* Logo upload */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ background: C.header, color: '#fff', padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>Logo de Empresa</div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
              <div style={{ width: 120, height: 80, border: `1px solid ${C.border}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.gridBg, overflow: 'hidden' }}>
                {logoUrl ? <img src={logoUrl} alt="logo actual" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span style={{ color: C.textLight, fontSize: 12 }}>Sin logo</span>}
              </div>
              <div>
                <label style={{ display: 'inline-block', padding: '10px 20px', background: C.accent, color: '#fff', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
                  {uploading ? 'Subiendo...' : 'Subir nuevo logo'}
                  <input type="file" accept="image/*" onChange={handleLogo} style={{ display: 'none' }} disabled={uploading} />
                </label>
                <div style={{ fontSize: 11, color: C.textLight, marginTop: 8 }}>PNG, JPG o SVG. Aparecerá en la barra superior.</div>
              </div>
            </div>

            {logos.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>Logos guardados</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {logos.map(l => {
                    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(l.name)
                    return (
                      <div key={l.name} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, textAlign: 'center', width: 110 }}>
                        <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                          <img src={publicUrl} alt={l.name} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                        </div>
                        <button onClick={() => setAsActive(l.name)} style={{ width: '100%', padding: '4px', background: C.accentLight, color: C.accent, border: 'none', borderRadius: 3, fontSize: 10, fontWeight: 600, marginBottom: 4, cursor: 'pointer' }}>Activar</button>
                        <button onClick={() => deleteLogo(l.name)} style={{ width: '100%', padding: '4px', background: C.redBg, color: C.red, border: 'none', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}>Eliminar</button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
