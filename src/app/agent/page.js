'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/layout'
import Navbar from '@/components/Navbar'
import { getReferences, getSeries } from '@/lib/series'
import { SKUS, MONTHS } from '@/lib/data'
import { bestForecast, detectOutliers } from '@/lib/models'

const C = { header:'#003c71', accent:'#0078d4', accentLight:'#cce4f7', accentDark:'#002855', border:'#c8d6e5', borderLight:'#dfe6ed', text:'#1a2b3c', textMuted:'#5a6f82', gridBg:'#f7f9fc', green:'#0b8043', white:'#fff' }

const OPENERS = [
  { icon: '📈', title: 'Comportamiento de la demanda', q: 'Analiza el comportamiento de la demanda de esta referencia: tendencia, nivel y variabilidad. Sé concreto.' },
  { icon: '🗓️', title: 'Estacionalidad', q: '¿Existe estacionalidad en esta referencia? Indica los meses fuertes y débiles y su impacto en el aprovisionamiento.' },
  { icon: '🎯', title: 'Modelo recomendado', q: '¿Qué modelo de forecast recomiendas para esta referencia y por qué? Justifica con la fiabilidad.' },
  { icon: '⚖️', title: 'Contrastar forecast comercial', q: 'El equipo comercial propone subir el forecast un 20% el próximo trimestre. Compáralo con el forecast estadístico y dime si es realista.' },
  { icon: '⚠️', title: 'Riesgos de stock', q: '¿Qué riesgos de rotura o exceso de stock ves en esta referencia según su demanda? Da recomendaciones de política de aprovisionamiento.' },
  { icon: '🧹', title: 'Limpieza de datos', q: '¿Detectas promociones o pedidos extraordinarios que ensucien la serie? ¿Qué meses excluirías del cálculo?' },
]

export default function AgentPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [refs, setRefs] = useState([])
  const [selRef, setSelRef] = useState(null)
  const [series, setSeries] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const chatEnd = useRef(null)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading, router])

  useEffect(() => {
    (async () => {
      let r = await getReferences()
      if (!r || r.length === 0) r = SKUS.map(s => ({ id: s.id, name: s.name, demo: true }))
      setRefs(r)
      if (r.length) setSelRef(r[0].id)
    })()
  }, [])

  useEffect(() => {
    if (!selRef) return
    setMessages([])
    ;(async () => {
      let s = await getSeries(selRef)
      if (!s) {
        const demo = SKUS.find(x => x.id === selRef)
        if (demo) s = { id: demo.id, name: demo.name, unit: demo.unit, months: MONTHS, values: demo.values }
      }
      setSeries(s)
    })()
  }, [selRef])

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  async function ask(q) {
    if (!series || busy) return
    setBusy(true)
    setMessages(m => [...m, { role: 'user', content: q }])
    setInput('')
    try {
      const excluded = detectOutliers(series.values)
      const best = bestForecast(series.values, excluded)
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: { id: series.id, name: series.name, family: '', unit: series.unit || 'Kg' },
          values: series.values, months: series.months, excluded: [...excluded],
          model: best.name, forecast: best.future.map(v => Math.round(v)),
          mape: best.mape.toFixed(1), r2: (best.r2 * 100).toFixed(1), reliability: Math.round(best.reliability),
          question: q
        })
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: data.text || `Error: ${data.error || 'sin respuesta'}` }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Error: ' + e.message }])
    }
    setBusy(false)
  }

  if (loading || !user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#eef2f7', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', maxWidth: 1100, width: '100%', margin: '0 auto', padding: '20px 24px', gap: 20, boxSizing: 'border-box' }}>

        {/* Left: chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', minHeight: 500 }}>
          <div style={{ background: `linear-gradient(135deg, ${C.header}, #00508f)`, color: '#fff', padding: '16px 20px' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>🤖 Agente de Demanda Infinnis</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
              Analizo tu demanda, detecto estacionalidad y promociones, comparo el forecast comercial con el estadístico y recomiendo políticas de stock.
            </div>
          </div>

          {/* Reference selector */}
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.borderLight}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>Referencia:</span>
            <select value={selRef || ''} onChange={e => setSelRef(e.target.value)}
              style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 13, minWidth: 260 }}>
              {refs.map(r => <option key={r.id} value={r.id}>{r.id} — {r.name}</option>)}
            </select>
            {series && <span style={{ fontSize: 11, color: C.textMuted }}>{series.values.length} meses</span>}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            {messages.length === 0 && (
              <div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 14 }}>Elige una pregunta para empezar, o escribe la tuya:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {OPENERS.map((o, i) => (
                    <button key={i} onClick={() => ask(o.q)} disabled={busy || !series}
                      style={{ textAlign: 'left', padding: '12px 14px', background: C.gridBg, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', opacity: series ? 1 : 0.5 }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{o.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{o.title}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 14, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%', padding: '12px 16px', borderRadius: 8, fontSize: 14, lineHeight: 1.6, background: m.role === 'user' ? C.accent : C.gridBg, color: m.role === 'user' ? '#fff' : C.text, whiteSpace: 'pre-wrap' }}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div style={{ color: C.textMuted, fontSize: 13, fontStyle: 'italic' }}>Analizando la demanda...</div>}
            <div ref={chatEnd} />
          </div>

          {/* Input */}
          <div style={{ padding: 14, borderTop: `1px solid ${C.borderLight}`, display: 'flex', gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && input.trim() && ask(input.trim())}
              placeholder="Escribe tu pregunta sobre la demanda..."
              style={{ flex: 1, padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, outline: 'none' }} />
            <button onClick={() => input.trim() && ask(input.trim())} disabled={busy || !input.trim()}
              style={{ padding: '10px 20px', background: C.accent, color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, opacity: (busy || !input.trim()) ? 0.5 : 1 }}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
