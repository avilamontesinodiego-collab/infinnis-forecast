'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/layout'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'

const C = { bg:'#eef2f7',white:'#ffffff',header:'#003c71',headerLight:'#00508f',accent:'#0078d4',accentLight:'#cce4f7',accentDark:'#002855',border:'#c8d6e5',borderLight:'#dfe6ed',text:'#1a2b3c',textMuted:'#5a6f82',textLight:'#8a9bac',gridBg:'#f7f9fc',green:'#0b8043',greenBg:'#e6f4ea',red:'#c5221f',orange:'#e37400',purple:'#7b1fa2' }

const OPENERS = [
  { icon:'📈', title:'Analiza mi demanda', desc:'Detecta tendencias, estacionalidad y patrones en tus ventas', q:'Analiza el comportamiento de la demanda de mis referencias. Detecta tendencias y estacionalidad.' },
  { icon:'⚠️', title:'Detecta anomalías', desc:'Identifica promociones y pedidos extraordinarios que ensucian el forecast', q:'¿Qué referencias tienen outliers o picos anómalos que debería revisar antes de pronosticar?' },
  { icon:'🎯', title:'Compara forecast comercial', desc:'Contrasta el forecast del equipo comercial con el estadístico', q:'¿Cómo comparo el forecast que sube mi equipo comercial con el forecast estadístico? ¿Qué gap debo vigilar?' },
  { icon:'📦', title:'Recomienda política de stock', desc:'Sugiere niveles de stock de seguridad según variabilidad', q:'Según la variabilidad de mi demanda, ¿qué política de stock de seguridad me recomiendas?' },
  { icon:'🔮', title:'Explica el pronóstico', desc:'Entiende por qué el modelo predice lo que predice', q:'Explícame en lenguaje sencillo por qué el modelo pronostica estos valores para los próximos meses.' },
  { icon:'📊', title:'Qué modelo usar', desc:'Aconseja el mejor método estadístico para cada referencia', q:'¿Qué modelo estadístico (media móvil, suavizado, regresión, Holt-Winters) me conviene para cada tipo de referencia?' },
]

export default function AgentPage() {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [refs, setRefs] = useState([])
  const endRef = useRef(null)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading, router])
  useEffect(() => { if (user) loadRefs() }, [user])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadRefs() {
    const { data } = await supabase.from('sku_monthly').select('referencia,descripcion,mes,ventas_kg').limit(5000)
    if (data && data.length) {
      const byRef = {}
      data.forEach(r => { (byRef[r.referencia] = byRef[r.referencia] || { ref: r.referencia, desc: r.descripcion, points: [] }).points.push({ mes: r.mes, v: r.ventas_kg }) })
      setRefs(Object.values(byRef))
    }
  }

  async function send(q) {
    const question = q || input.trim()
    if (!question) return
    setMessages(m => [...m, { role: 'user', content: question }])
    setInput('')
    setBusy(true)
    try {
      const summary = refs.slice(0, 30).map(r => `${r.ref} (${r.desc||''}): ${r.points.length} meses, último=${r.points[r.points.length-1]?.v}`).join('\n')
      const res = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, refsSummary: summary, refCount: refs.length, history: messages.slice(-6) })
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: data.text || `Error: ${data.error}` }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Error: ${e.message}` }])
    }
    setBusy(false)
  }

  if (loading || !user) return null

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 900, margin: '0 auto', width: '100%', padding: '20px 24px' }}>

        {/* Agent header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: `linear-gradient(135deg, ${C.header}, ${C.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🤖</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Agente Forecast IA</h1>
            <p style={{ fontSize: 13, color: C.textMuted, margin: '2px 0 0' }}>
              Experto en operaciones y demanda · {refs.length > 0 ? `${refs.length} referencias cargadas` : 'sin datos aún'}
            </p>
          </div>
        </div>

        {messages.length === 0 ? (
          <>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 16 }}>Soy tu analista de demanda. Esto es lo que puedo hacer por ti:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {OPENERS.map((o, i) => (
                <button key={i} onClick={() => send(o.q)}
                  style={{ textAlign: 'left', background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, cursor: 'pointer', transition: 'all .15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{o.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{o.title}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.4 }}>{o.desc}</div>
                </button>
              ))}
            </div>
            {refs.length === 0 && (
              <div style={{ marginTop: 20, background: '#fef3e0', border: `1px solid ${C.orange}`, borderRadius: 4, padding: '12px 16px', fontSize: 13, color: C.orange }}>
                💡 Aún no has subido datos. Ve a "Subir Datos" para cargar tus ventas y el agente podrá analizarlas.
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, overflow: 'auto', marginBottom: 16, minHeight: 300 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 16, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '80%', padding: '12px 16px', borderRadius: 10, fontSize: 14, lineHeight: 1.6, background: m.role === 'user' ? C.accent : C.gridBg, color: m.role === 'user' ? '#fff' : C.text, whiteSpace: 'pre-wrap' }}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div style={{ color: C.textMuted, fontSize: 13, fontStyle: 'italic' }}>Analizando...</div>}
            <div ref={endRef} />
          </div>
        )}

        {/* Input */}
        <div style={{ display: 'flex', gap: 8, marginTop: messages.length === 0 ? 20 : 0 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Escribe tu pregunta sobre demanda, forecast, stock..."
            style={{ flex: 1, padding: '12px 16px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, outline: 'none' }} />
          <button onClick={() => send()} disabled={busy}
            style={{ padding: '12px 24px', background: C.header, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, opacity: busy ? 0.5 : 1 }}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
