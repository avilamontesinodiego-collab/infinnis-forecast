'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, BarChart, Bar, Cell } from 'recharts'
import { supabase } from '@/lib/supabase'
import { getReferences, getSeries } from '@/lib/series'
import { SKUS, MONTHS, FUTURE_MONTHS } from '@/lib/data'
import { movingAverage, expSmooth, linReg, holtWinters, calcMAPE, calcR2, detectOutliers } from '@/lib/models'

const C = { bg:'#eef2f7',white:'#ffffff',header:'#003c71',headerLight:'#00508f',accent:'#0078d4',accentLight:'#cce4f7',accentDark:'#002855',border:'#c8d6e5',borderLight:'#dfe6ed',text:'#1a2b3c',textMuted:'#5a6f82',textLight:'#8a9bac',gridBg:'#f7f9fc',green:'#0b8043',greenBg:'#e6f4ea',red:'#c5221f',redBg:'#fce8e6',orange:'#e37400',orangeBg:'#fef3e0',purple:'#7b1fa2' }

const WIDGETS = [
  { id: 'kpis', title: 'Indicadores (KPIs)', icon: '📊' },
  { id: 'ventas_forecast', title: 'Ventas vs Pronóstico', icon: '📈' },
  { id: 'modelos', title: 'Fiabilidad por modelo', icon: '🎯' },
  { id: 'forecast_cards', title: 'Pronóstico 6 meses', icon: '🗓️' },
  { id: 'estacionalidad', title: 'Estacionalidad', icon: '🔄' },
  { id: 'datos', title: 'Tabla de datos', icon: '📋' },
]
const DEFAULT_ORDER = ['kpis', 'ventas_forecast', 'modelos', 'forecast_cards']

function NavTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (<div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', fontSize: 13 }}>
    <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</div>
    {payload.map((p, i) => p.value != null && <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: p.color }} /><span style={{ color: C.textMuted }}>{p.name}:</span><span style={{ fontWeight: 600 }}>{Math.round(p.value).toLocaleString('es-ES')}</span></div>)}
  </div>)
}

export default function Dashboard() {
  const [refs, setRefs] = useState([])
  const [selRef, setSelRef] = useState(null)
  const [series, setSeries] = useState(null)
  const [excluded, setExcluded] = useState(new Set())
  const [order, setOrder] = useState(DEFAULT_ORDER)
  const [dragId, setDragId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Load references + layout
  useEffect(() => {
    (async () => {
      let r = await getReferences()
      if (!r || r.length === 0) r = SKUS.map(s => ({ id: s.id, name: s.name, demo: true }))
      setRefs(r)
      if (r.length) setSelRef(r[0].id)
      const { data } = await supabase.from('app_config').select('value').eq('key', 'dashboard_layout').single()
      if (data?.value?.order && Array.isArray(data.value.order)) {
        const valid = data.value.order.filter(id => WIDGETS.some(w => w.id === id))
        if (valid.length) setOrder(valid)
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: ur } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
        setIsAdmin(ur?.role === 'admin')
      }
    })()
  }, [])

  useEffect(() => {
    if (!selRef) return
    setExcluded(new Set())
    ;(async () => {
      let s = await getSeries(selRef)
      if (!s) { const d = SKUS.find(x => x.id === selRef); if (d) s = { id: d.id, name: d.name, unit: d.unit, months: MONTHS, values: d.values } }
      setSeries(s)
    })()
  }, [selRef])

  const saveLayout = useCallback(async (newOrder) => {
    const hidden = WIDGETS.map(w => w.id).filter(id => !newOrder.includes(id))
    await supabase.from('app_config').update({ value: { order: newOrder, hidden }, updated_at: new Date().toISOString() }).eq('key', 'dashboard_layout')
  }, [])

  const setOrderPersist = (next) => { setOrder(next); saveLayout(next) }
  const removeWidget = (id) => setOrderPersist(order.filter(x => x !== id))
  const addWidget = (id) => { if (!order.includes(id)) setOrderPersist([...order, id]) }
  const move = (id, dir) => {
    const i = order.indexOf(id); const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order];[next[i], next[j]] = [next[j], next[i]]; setOrderPersist(next)
  }
  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) return
    const next = order.filter(x => x !== dragId)
    const idx = next.indexOf(targetId)
    next.splice(idx, 0, dragId); setOrderPersist(next); setDragId(null)
  }

  const toggleExclude = (idx) => setExcluded(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })

  const suggested = useMemo(() => series ? detectOutliers(series.values) : new Set(), [series])

  const models = useMemo(() => {
    if (!series) return null
    const d = series.values
    const ma = movingAverage(d, excluded, 3), es = expSmooth(d, excluded, .3), lr = linReg(d, excluded), hw = holtWinters(d, excluded)
    const vMA = ma.filter(v => v !== null), lastMA = vMA.length ? vMA[vMA.length - 1] : d[d.length - 1]
    const vES = es.filter(v => v !== null), lastES = vES.length ? vES[vES.length - 1] : d[d.length - 1]
    const r = {}
    r.ma = { name: 'Media Móvil (3)', fitted: ma, future: Array.from({ length: 6 }, (_, i) => lastMA * (1 + lr.slope / Math.max(1, lr.intercept + lr.slope * d.length) * (i + 1))), color: '#0078d4' }
    r.es = { name: 'Suavizado Exp.', fitted: es, future: Array.from({ length: 6 }, (_, i) => lastES * (1 + lr.slope / Math.max(1, lr.intercept + lr.slope * d.length) * (i + 1))), color: C.orange }
    r.lr = { name: 'Regresión Lineal', fitted: lr.fitted, future: lr.future, color: C.green }
    if (hw) r.hw = { name: 'Holt-Winters', fitted: hw.fitted, future: hw.future, color: C.purple }
    for (const m of Object.values(r)) { m.mape = calcMAPE(d, m.fitted, excluded); m.r2 = calcR2(d, m.fitted, excluded); m.reliability = Math.max(0, Math.min(100, 100 - m.mape)) }
    let bk = 'lr', bs = -1; for (const [k, m] of Object.entries(r)) if (m.reliability > bs) { bs = m.reliability; bk = k }
    r._best = bk; return r
  }, [series, excluded])

  const sel = models ? models[models._best] : null

  const chartData = useMemo(() => {
    if (!series || !sel) return []
    const d = series.values, rows = []
    for (let i = 0; i < d.length; i++) rows.push({ month: series.months[i], real: excluded.has(i) ? null : d[i], forecast: sel.fitted[i] != null ? Math.round(sel.fitted[i]) : null, outlier: suggested.has(i) && !excluded.has(i) ? d[i] : null })
    for (let i = 0; i < 6; i++) rows.push({ month: FUTURE_MONTHS[i], real: null, forecast: Math.round(sel.future[i]) })
    return rows
  }, [series, sel, excluded, suggested])

  const seasonalData = useMemo(() => {
    if (!series) return []
    const buckets = {}
    series.values.forEach((v, i) => { if (excluded.has(i)) return; const m = (series.months[i] || '').slice(0, 3); buckets[m] = buckets[m] || []; buckets[m].push(v) })
    const order3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return order3.filter(m => buckets[m]).map(m => ({ mes: m, media: Math.round(buckets[m].reduce((a, b) => a + b, 0) / buckets[m].length) }))
  }, [series, excluded])

  const rc = r => r >= 85 ? C.green : r >= 70 ? C.orange : C.red
  const rl = r => r >= 85 ? 'EXCELENTE' : r >= 70 ? 'BUENO' : r >= 50 ? 'ACEPTABLE' : 'BAJO'

  if (!series || !models) return <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Cargando datos...</div>

  const CardHeader = ({ id, title }) => (
    <div draggable onDragStart={() => setDragId(id)} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(id)}
      style={{ background: C.header, color: '#fff', padding: '8px 14px', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab' }}>
      <span>⋮⋮ {title}</span>
      <span style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => move(id, -1)} style={btnMini}>↑</button>
        <button onClick={() => move(id, 1)} style={btnMini}>↓</button>
        <button onClick={() => removeWidget(id)} style={{ ...btnMini, background: 'rgba(197,34,31,0.4)' }}>✕</button>
      </span>
    </div>
  )

  function renderWidget(id) {
    switch (id) {
      case 'kpis':
        return (<div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 12 }}>
          {[
            { l: 'Fiabilidad', v: `${Math.round(sel.reliability)}%`, c: rc(sel.reliability), s: rl(sel.reliability) },
            { l: 'R²', v: `${(sel.r2 * 100).toFixed(1)}%`, c: C.accent, s: 'Ajuste' },
            { l: 'MAPE', v: `${sel.mape.toFixed(1)}%`, c: sel.mape < 10 ? C.green : sel.mape < 20 ? C.orange : C.red, s: 'Error medio' },
            { l: 'Modelo', v: sel.name, c: sel.color, s: '★ Mejor', small: true },
            { l: 'Próximo mes', v: Math.round(sel.future[0]).toLocaleString('es-ES'), c: C.accent, s: `${FUTURE_MONTHS[0]} · ${series.unit}` },
          ].map((k, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${k.c}`, paddingLeft: 12 }}>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ fontSize: k.small ? 15 : 26, fontWeight: 700, color: k.c, lineHeight: 1.2, marginTop: 4 }}>{k.v}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{k.s}</div>
            </div>
          ))}
        </div>)
      case 'ventas_forecast':
        return (<div style={{ padding: '12px 12px 4px' }}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 16, bottom: 5, left: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.textMuted }} angle={-45} textAnchor="end" height={52} />
              <YAxis tick={{ fontSize: 11, fill: C.textMuted }} />
              <Tooltip content={<NavTooltip />} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="forecast" fill={sel.color} fillOpacity={.06} stroke="none" legendType="none" />
              <Line type="monotone" dataKey="real" name="Ventas reales" stroke={C.header} strokeWidth={2.5} dot={{ r: 3, fill: C.header }} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" name={sel.name} stroke={sel.color} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 2 }} />
              <Line type="monotone" dataKey="outlier" name="Outlier" stroke={C.orange} strokeWidth={0} dot={{ r: 6, fill: C.orange, stroke: '#fff', strokeWidth: 2 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>)
      case 'modelos':
        const md = Object.entries(models).filter(([k]) => k !== '_best').map(([k, m]) => ({ name: m.name, rel: Math.round(m.reliability), color: m.color, best: k === models._best })).sort((a, b) => b.rel - a.rel)
        return (<div style={{ padding: '12px 12px 4px' }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={md} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: C.textMuted }} unit="%" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: C.text }} width={110} />
              <Tooltip content={<NavTooltip />} />
              <Bar dataKey="rel" name="Fiabilidad" radius={[0, 4, 4, 0]}>
                {md.map((e, i) => <Cell key={i} fill={e.best ? C.green : '#94a3b8'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>)
      case 'forecast_cards':
        return (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)' }}>
          {FUTURE_MONTHS.map((m, i) => { const val = Math.round(sel.future[i]); const py = series.values[i] || val; const pct = Math.round(((val - py) / py) * 100)
            return (<div key={m} style={{ padding: 12, textAlign: 'center', borderRight: i < 5 ? `1px solid ${C.borderLight}` : 'none' }}>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{m}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.accentDark }}>{val.toLocaleString('es-ES')}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: pct >= 0 ? C.green : C.red, marginTop: 2 }}>{pct >= 0 ? '▲' : '▼'} {Math.abs(pct)}%</div>
            </div>) })}
        </div>)
      case 'estacionalidad':
        return (<div style={{ padding: '12px 12px 4px' }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={seasonalData} margin={{ left: 6, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 11, fill: C.textMuted }} />
              <Tooltip content={<NavTooltip />} />
              <Bar dataKey="media" name="Media mensual" fill={C.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>)
      case 'datos':
        return (<div style={{ maxHeight: 280, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: C.gridBg, position: 'sticky', top: 0 }}>
              <th style={{ textAlign: 'left', padding: '7px 12px', color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>Mes</th>
              <th style={{ textAlign: 'right', padding: '7px 12px', color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>Real</th>
              <th style={{ textAlign: 'right', padding: '7px 12px', color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>Fcst</th>
              <th style={{ textAlign: 'center', padding: '7px 8px', color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>Est</th>
            </tr></thead>
            <tbody>
              {series.values.map((v, i) => { const isEx = excluded.has(i), isOu = suggested.has(i), ft = sel.fitted[i]
                return (<tr key={i} onClick={() => toggleExclude(i)} style={{ background: isEx ? C.redBg : isOu ? C.orangeBg : i % 2 ? C.gridBg : C.white, cursor: 'pointer', opacity: isEx ? .5 : 1 }}>
                  <td style={{ padding: '6px 12px' }}>{series.months[i]}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, textDecoration: isEx ? 'line-through' : 'none' }}>{Number(v).toLocaleString('es-ES')}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: C.textMuted }}>{ft != null ? Math.round(ft).toLocaleString('es-ES') : '—'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{isEx ? <span style={{ color: C.red }}>✕</span> : isOu ? <span style={{ color: C.orange }}>⚠</span> : <span style={{ color: C.green }}>✓</span>}</td>
                </tr>) })}
            </tbody>
          </table>
        </div>)
      default: return null
    }
  }

  const available = WIDGETS.filter(w => !order.includes(w.id))

  return (
    <div style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* Main board */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Reference selector */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>Referencia:</span>
          <select value={selRef || ''} onChange={e => setSelRef(e.target.value)} style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 13, minWidth: 260 }}>
            {refs.map(r => <option key={r.id} value={r.id}>{r.id} — {r.name}</option>)}
          </select>
          {excluded.size > 0 && <span style={{ fontSize: 11, color: C.textMuted }}>{excluded.size} excluidos</span>}
          {excluded.size > 0 && <button onClick={() => setExcluded(new Set())} style={{ padding: '4px 10px', fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 3, background: C.white, color: C.red }}>Restaurar</button>}
        </div>

        {/* Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {order.map(id => {
            const w = WIDGETS.find(x => x.id === id); if (!w) return null
            return (<div key={id} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(id)} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
              <CardHeader id={id} title={w.title} />
              {renderWidget(id)}
            </div>)
          })}
          {order.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, background: C.white, border: `1px dashed ${C.border}`, borderRadius: 4 }}>Añade gráficos desde el panel de la derecha →</div>}
        </div>
      </div>

      {/* Palette */}
      <div style={{ width: 220, flexShrink: 0, position: 'sticky', top: 16 }}>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ background: C.headerLight, color: '#fff', padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>Añadir gráficos</div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {available.length === 0 && <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 8 }}>Todos añadidos</div>}
            {available.map(w => (
              <div key={w.id} draggable onDragStart={() => setDragId(w.id)}
                style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', background: C.gridBg, cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, color: C.text }}>{w.icon} {w.title}</span>
                <button onClick={() => addWidget(w.id)} style={{ padding: '3px 10px', background: C.accent, color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 700 }}>+</button>
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.borderLight}`, fontSize: 10, color: C.textLight }}>
            Arrastra en escritorio · pulsa + en iPad. Usa ↑↓ para reordenar y ✕ para quitar.
          </div>
        </div>
      </div>
    </div>
  )
}

const btnMini = { width: 22, height: 22, borderRadius: 3, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }
