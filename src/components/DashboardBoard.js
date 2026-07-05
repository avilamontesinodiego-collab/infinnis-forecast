'use client'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, BarChart, Bar, Cell } from 'recharts'
import { SKUS, MONTHS, FUTURE_MONTHS } from '@/lib/data'
import { buildModels, detectOutliers } from '@/lib/forecast'
import { supabase } from '@/lib/supabase'

const C = { bg:'#eef2f7',white:'#ffffff',header:'#003c71',headerLight:'#00508f',accent:'#0078d4',accentLight:'#cce4f7',accentDark:'#002855',border:'#c8d6e5',borderLight:'#dfe6ed',text:'#1a2b3c',textMuted:'#5a6f82',textLight:'#8a9bac',gridBg:'#f7f9fc',green:'#0b8043',greenBg:'#e6f4ea',red:'#c5221f',redBg:'#fce8e6',orange:'#e37400',orangeBg:'#fef3e0',purple:'#7b1fa2' }

const WIDGET_CATALOG = [
  { type:'kpis', name:'Indicadores KPI', icon:'📇', desc:'Fiabilidad, R², MAPE, próximo mes' },
  { type:'mainChart', name:'Gráfico Pronóstico', icon:'📈', desc:'Histórico + forecast' },
  { type:'modelTable', name:'Comparación Modelos', icon:'📋', desc:'Fiabilidad por modelo' },
  { type:'reliabilityBar', name:'Barras Fiabilidad', icon:'📊', desc:'Ranking de modelos' },
  { type:'dataTable', name:'Tabla Datos', icon:'🗂️', desc:'Histórico + excluir outliers' },
  { type:'forecastCards', name:'Tarjetas Pronóstico', icon:'🔮', desc:'6 meses futuros' },
  { type:'seasonal', name:'Perfil Estacional', icon:'🌡️', desc:'Media por mes del año' },
]

const DEFAULT_LAYOUT = ['kpis','mainChart','modelTable','dataTable','forecastCards']

function NavTooltip({active,payload,label}){
  if(!active||!payload?.length)return null
  return(<div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:'10px 14px',boxShadow:'0 2px 8px rgba(0,0,0,0.12)',fontSize:13}}>
    <div style={{fontWeight:600,color:C.text,marginBottom:6}}>{label}</div>
    {payload.map((p,i)=>p.value!=null&&<div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}><span style={{width:10,height:10,borderRadius:2,background:p.color,display:'inline-block'}}/><span style={{color:C.textMuted}}>{p.name}:</span><span style={{fontWeight:600,color:C.text}}>{Math.round(p.value)}</span></div>)}
  </div>)
}

export default function DashboardBoard() {
  const [dbRefs, setDbRefs] = useState([])
  const [skuIdx, setSkuIdx] = useState(0)
  const [excluded, setExcluded] = useState(new Set())
  const [activeModel, setActiveModel] = useState('auto')
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [editMode, setEditMode] = useState(false)
  const dragItem = useRef(null)

  // Load uploaded refs from Supabase; fall back to sample SKUS
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('sku_monthly').select('referencia,descripcion,mes,mes_ord,ventas_kg').limit(8000)
      if (data && data.length) {
        const byRef = {}
        data.forEach(r => {
          if (!byRef[r.referencia]) byRef[r.referencia] = { id: r.referencia, name: r.descripcion || r.referencia, family: 'Datos', unit: 'Ud', rows: [] }
          byRef[r.referencia].rows.push({ mes: r.mes, ord: r.mes_ord ?? 0, v: Number(r.ventas_kg) })
        })
        const built = Object.values(byRef).map(s => {
          s.rows.sort((a,b) => (a.ord - b.ord) || String(a.mes).localeCompare(String(b.mes)))
          s.values = s.rows.map(r => r.v)
          s.months = s.rows.map(r => r.mes)
          return s
        }).filter(s => s.values.length >= 6)
        if (built.length) setDbRefs(built)
      }
    })()
  }, [])

  const sources = dbRefs.length ? dbRefs : SKUS.map(s => ({ ...s, months: MONTHS }))
  const sku = sources[Math.min(skuIdx, sources.length - 1)]
  const months = sku.months || MONTHS

  useEffect(() => { setExcluded(new Set()) }, [skuIdx, dbRefs.length])

  const suggestedOutliers = useMemo(() => detectOutliers(sku.values), [sku])
  const models = useMemo(() => buildModels(sku.values, excluded, C), [sku, excluded])
  const bestKey = models._best
  const selected = activeModel === 'auto' ? bestKey : (models[activeModel] ? activeModel : bestKey)
  const sel = models[selected]

  const toggleExclude = useCallback(idx => setExcluded(prev => { const n = new Set(prev); n.has(idx)?n.delete(idx):n.add(idx); return n }), [])
  const rc = r => r>=85?C.green:r>=70?C.orange:C.red
  const rl = r => r>=85?'EXCELENTE':r>=70?'BUENO':r>=50?'ACEPTABLE':'BAJO'

  const chartData = useMemo(() => {
    const rows = []
    for(let i=0;i<sku.values.length;i++) rows.push({ month:months[i], real:excluded.has(i)?null:sku.values[i], excluded:excluded.has(i)?sku.values[i]:null, outlier:suggestedOutliers.has(i)&&!excluded.has(i)?sku.values[i]:null, forecast:sel.fitted[i]!=null?Math.round(sel.fitted[i]):null })
    for(let i=0;i<6;i++) rows.push({ month:FUTURE_MONTHS[i], forecast:Math.round(sel.future[i]) })
    return rows
  }, [sku, months, excluded, sel, suggestedOutliers])

  const seasonalData = useMemo(() => {
    const short = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const buckets = short.map(() => [])
    sku.values.forEach((v,i) => { if(!excluded.has(i)) buckets[i%12].push(v) })
    return short.map((m,i) => ({ month:m, media: buckets[i].length ? Math.round(buckets[i].reduce((a,b)=>a+b,0)/buckets[i].length) : 0 }))
  }, [sku, excluded])

  // Widget management
  const addWidget = t => setLayout(l => [...l, t])
  const removeWidget = i => setLayout(l => l.filter((_,idx) => idx !== i))
  const moveWidget = (i, dir) => setLayout(l => { const n=[...l]; const j=i+dir; if(j<0||j>=n.length)return n; [n[i],n[j]]=[n[j],n[i]]; return n })
  const onDragStart = i => { dragItem.current = i }
  const onDrop = i => {
    setLayout(l => {
      const n=[...l]; const from=dragItem.current
      if(typeof from==='string' && from.startsWith('ADD:')){ n.splice(i,0,from.slice(4)); return n }
      if(from==null||from===i)return n; const [m]=n.splice(from,1); n.splice(i,0,m); return n
    })
    dragItem.current=null
  }

  function renderWidget(type) {
    switch(type) {
      case 'kpis': return (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',gap:12}}>
          {[
            {l:'Fiabilidad',v:`${Math.round(sel.reliability)}%`,c:rc(sel.reliability),s:rl(sel.reliability)},
            {l:'R²',v:`${(sel.r2*100).toFixed(1)}%`,c:C.accent,s:'Ajuste'},
            {l:'MAPE',v:`${sel.mape.toFixed(1)}%`,c:sel.mape<10?C.green:sel.mape<20?C.orange:C.red,s:'Error medio'},
            {l:'Modelo',v:sel.name,c:sel.color,s:selected===bestKey?'★ Mejor':'',small:true},
            {l:'Próximo mes',v:`${Math.round(sel.future[0])}`,c:C.accent,s:`${FUTURE_MONTHS[0]} · ${sku.unit}`},
          ].map((k,i)=>(
            <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:16,borderTop:`3px solid ${k.c}`}}>
              <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase',letterSpacing:.5}}>{k.l}</div>
              <div style={{fontSize:k.small?15:30,fontWeight:700,color:k.c,lineHeight:1.2,marginTop:k.small?8:4}}>{k.v}</div>
              {k.s&&<div style={{fontSize:11,fontWeight:600,color:k.c===C.accent?C.textMuted:k.c,marginTop:2}}>{k.s}</div>}
            </div>
          ))}
        </div>
      )
      case 'mainChart': return (
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:'16px 16px 8px'}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:12}}>{sku.name} — {sel.name}</div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{top:5,right:20,bottom:5,left:10}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight}/>
              <XAxis dataKey="month" tick={{fontSize:10,fill:C.textMuted}} angle={-45} textAnchor="end" height={55}/>
              <YAxis tick={{fontSize:11,fill:C.textMuted}}/>
              <Tooltip content={<NavTooltip/>}/><Legend wrapperStyle={{fontSize:12}}/>
              <Area type="monotone" dataKey="forecast" fill={sel.color} fillOpacity={.06} stroke="none" legendType="none"/>
              <Line type="monotone" dataKey="real" name="Ventas reales" stroke={C.header} strokeWidth={2.5} dot={{r:4,fill:C.header,stroke:'#fff',strokeWidth:2}} connectNulls={false}/>
              <Line type="monotone" dataKey="forecast" name={sel.name} stroke={sel.color} strokeWidth={2} strokeDasharray="6 3" dot={{r:3,fill:sel.color}}/>
              <Line type="monotone" dataKey="outlier" name="Outlier" stroke={C.orange} strokeWidth={0} dot={{r:7,fill:C.orange,stroke:'#fff',strokeWidth:2}} connectNulls={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )
      case 'modelTable': return (
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,overflow:'hidden'}}>
          <div style={{background:C.header,color:'#fff',padding:'10px 16px',fontSize:13,fontWeight:600}}>Comparación de Modelos</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:C.gridBg}}>
              <th style={{textAlign:'left',padding:'8px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Modelo</th>
              <th style={{textAlign:'center',padding:'8px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Fiabilidad</th>
              <th style={{textAlign:'center',padding:'8px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>R²</th>
              <th style={{textAlign:'center',padding:'8px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>MAPE</th>
            </tr></thead>
            <tbody>
              {Object.entries(models).filter(([k])=>k!=='_best').sort((a,b)=>b[1].reliability-a[1].reliability).map(([k,m],i)=>
                <tr key={k} style={{background:i%2===0?C.white:C.gridBg}}>
                  <td style={{padding:'10px 12px',fontWeight:k===bestKey?700:400}}><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:m.color,marginRight:8,verticalAlign:'middle'}}/>{m.name}</td>
                  <td style={{textAlign:'center',padding:'10px 12px'}}><span style={{padding:'3px 10px',borderRadius:3,fontWeight:700,color:rc(m.reliability),background:m.reliability>=85?C.greenBg:m.reliability>=70?C.orangeBg:C.redBg}}>{Math.round(m.reliability)}%</span></td>
                  <td style={{textAlign:'center',padding:'10px 12px',fontVariantNumeric:'tabular-nums'}}>{(m.r2*100).toFixed(1)}%</td>
                  <td style={{textAlign:'center',padding:'10px 12px',fontVariantNumeric:'tabular-nums'}}>{m.mape.toFixed(1)}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )
      case 'reliabilityBar': {
        const bars = Object.entries(models).filter(([k])=>k!=='_best').map(([k,m])=>({name:m.name.split(' ')[0],rel:Math.round(m.reliability),color:m.color,best:k===bestKey})).sort((a,b)=>b.rel-a.rel)
        return (
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:'16px'}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:12}}>Ranking Fiabilidad</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bars} layout="vertical" margin={{left:10,right:20}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} horizontal={false}/>
                <XAxis type="number" domain={[0,100]} tick={{fontSize:11,fill:C.textMuted}} unit="%"/>
                <YAxis dataKey="name" type="category" tick={{fontSize:11,fill:C.text}} width={90}/>
                <Tooltip content={<NavTooltip/>}/>
                <Bar dataKey="rel" name="Fiabilidad" radius={[0,4,4,0]}>{bars.map((b,i)=><Cell key={i} fill={b.best?C.green:C.accent}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }
      case 'dataTable': return (
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,overflow:'hidden'}}>
          <div style={{background:C.header,color:'#fff',padding:'10px 16px',fontSize:13,fontWeight:600,display:'flex',justifyContent:'space-between'}}><span>Datos Históricos</span><span style={{fontSize:11,opacity:.7}}>Click = excluir</span></div>
          <div style={{maxHeight:280,overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:C.gridBg,position:'sticky',top:0}}>
                <th style={{textAlign:'left',padding:'7px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Mes</th>
                <th style={{textAlign:'right',padding:'7px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Real</th>
                <th style={{textAlign:'right',padding:'7px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Fcst</th>
                <th style={{textAlign:'right',padding:'7px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Err%</th>
                <th style={{textAlign:'center',padding:'7px 8px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Est</th>
              </tr></thead>
              <tbody>
                {sku.values.map((v,i)=>{const isEx=excluded.has(i),isOu=suggestedOutliers.has(i),ft=sel.fitted[i];const err=ft!=null&&!isEx?((v-ft)/v*100):null
                  return(<tr key={i} onClick={()=>toggleExclude(i)} style={{background:isEx?C.redBg:isOu?C.orangeBg:i%2===0?C.white:C.gridBg,cursor:'pointer',opacity:isEx?.5:1}}>
                    <td style={{padding:'7px 12px'}}>{months[i]}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',fontWeight:600,fontVariantNumeric:'tabular-nums',textDecoration:isEx?'line-through':'none'}}>{Math.round(v)}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',color:C.textMuted,fontVariantNumeric:'tabular-nums'}}>{ft!=null?Math.round(ft):'—'}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',fontVariantNumeric:'tabular-nums',color:err!=null?(Math.abs(err)<10?C.green:Math.abs(err)<20?C.orange:C.red):C.textLight}}>{err!=null?`${err>0?'+':''}${err.toFixed(1)}%`:'—'}</td>
                    <td style={{padding:'7px 8px',textAlign:'center'}}>{isEx?<span style={{color:C.red,fontSize:10,fontWeight:600}}>✕</span>:isOu?<span style={{color:C.orange,fontSize:10,fontWeight:600}}>⚠</span>:<span style={{color:C.green,fontSize:10}}>✓</span>}</td>
                  </tr>)})}
              </tbody>
            </table>
          </div>
        </div>
      )
      case 'forecastCards': return (
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,overflow:'hidden'}}>
          <div style={{background:C.header,color:'#fff',padding:'10px 16px',fontSize:13,fontWeight:600}}>Pronóstico 6 Meses · {sel.name} · Fiab. {Math.round(sel.reliability)}%</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6, 1fr)'}}>
            {FUTURE_MONTHS.map((m,i)=>{const val=Math.round(sel.future[i]),py=sku.values[i]||val,pct=Math.round(((val-py)/py)*100)
              return(<div key={m} style={{padding:14,textAlign:'center',borderRight:i<5?`1px solid ${C.borderLight}`:'none'}}>
                <div style={{fontSize:11,color:C.textMuted,fontWeight:600,marginBottom:4}}>{m}</div>
                <div style={{fontSize:24,fontWeight:700,color:C.accentDark}}>{val}</div>
                <div style={{fontSize:10,color:C.textMuted}}>{sku.unit}</div>
                <div style={{fontSize:12,fontWeight:600,color:pct>=0?C.green:C.red,marginTop:4}}>{pct>=0?'▲':'▼'} {Math.abs(pct)}%</div>
              </div>)})}
          </div>
        </div>
      )
      case 'seasonal': return (
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:'16px'}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:12}}>Perfil Estacional (media por mes)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={seasonalData} margin={{top:5,right:10,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight}/>
              <XAxis dataKey="month" tick={{fontSize:10,fill:C.textMuted}}/>
              <YAxis tick={{fontSize:11,fill:C.textMuted}}/>
              <Tooltip content={<NavTooltip/>}/>
              <Bar dataKey="media" name="Media" fill={C.accent} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
      default: return null
    }
  }

  const usedTypes = new Set(layout)

  return (
    <div style={{ display:'flex', gap:0 }}>
      {/* Main board */}
      <div style={{ flex:1, padding:'16px 20px', minWidth:0 }}>
        {/* Controls */}
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:4, padding:'10px 16px', marginBottom:16, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>Referencia:</span>
          <select value={skuIdx} onChange={e=>setSkuIdx(+e.target.value)} style={{ padding:'6px 12px', border:`1px solid ${C.border}`, borderRadius:3, fontSize:13, background:C.white, minWidth:260 }}>
            {sources.map((s,i)=><option key={s.id+i} value={i}>{s.id} — {s.name}</option>)}
          </select>
          {dbRefs.length===0 && <span style={{ fontSize:11, padding:'3px 10px', background:C.orangeBg, color:C.orange, borderRadius:3, fontWeight:600 }}>Datos de ejemplo</span>}
          <div style={{flex:1}}/>
          <span style={{ fontSize:12, color:C.textMuted }}>Modelo:</span>
          {[{key:'auto',label:'Auto'},{key:'ma',label:'M.Móvil'},{key:'es',label:'Suav.'},{key:'lr',label:'Regr.'},...(models.hw?[{key:'hw',label:'H-W'}]:[])].map(b=>
            <button key={b.key} onClick={()=>setActiveModel(b.key)} style={{padding:'5px 12px',borderRadius:3,fontSize:12,fontWeight:500,border:`1px solid ${activeModel===b.key?C.accent:C.border}`,background:activeModel===b.key?C.accentLight:C.white,color:activeModel===b.key?C.accentDark:C.text}}>{b.label}</button>
          )}
          <button onClick={()=>setEditMode(e=>!e)} style={{padding:'6px 14px',borderRadius:3,fontSize:12,fontWeight:600,border:'none',background:editMode?C.orange:C.header,color:'#fff'}}>{editMode?'✓ Hecho':'✎ Editar panel'}</button>
        </div>

        {/* Widgets */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {layout.map((type, i) => {
            const cat = WIDGET_CATALOG.find(w=>w.type===type)
            return (
              <div key={type+i}
                draggable={editMode}
                onDragStart={()=>onDragStart(i)}
                onDragOver={e=>e.preventDefault()}
                onDrop={()=>onDrop(i)}
                style={{ position:'relative', border:editMode?`2px dashed ${C.accent}`:'none', borderRadius:6, padding:editMode?8:0 }}>
                {editMode && (
                  <div style={{ position:'absolute', top:-10, right:8, zIndex:10, display:'flex', gap:4, background:C.white, border:`1px solid ${C.border}`, borderRadius:4, padding:'2px 4px', boxShadow:'0 1px 4px rgba(0,0,0,0.15)' }}>
                    <span style={{ fontSize:11, color:C.textMuted, padding:'2px 6px', cursor:'grab' }}>⠿ {cat?.name}</span>
                    <button onClick={()=>moveWidget(i,-1)} style={{border:'none',background:C.gridBg,borderRadius:3,cursor:'pointer',fontSize:12,padding:'2px 6px'}}>↑</button>
                    <button onClick={()=>moveWidget(i,1)} style={{border:'none',background:C.gridBg,borderRadius:3,cursor:'pointer',fontSize:12,padding:'2px 6px'}}>↓</button>
                    <button onClick={()=>removeWidget(i)} style={{border:'none',background:C.redBg,color:C.red,borderRadius:3,cursor:'pointer',fontSize:12,padding:'2px 8px',fontWeight:700}}>✕</button>
                  </div>
                )}
                {renderWidget(type)}
              </div>
            )
          })}
          {layout.length===0 && <div style={{textAlign:'center',padding:60,color:C.textMuted,background:C.white,border:`1px dashed ${C.border}`,borderRadius:6}}>Panel vacío. Añade gráficos desde la derecha →</div>}
        </div>
      </div>

      {/* Right palette */}
      {editMode && (
        <div style={{ width:240, background:C.white, borderLeft:`1px solid ${C.border}`, padding:16, minHeight:'calc(100vh - 50px)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:4 }}>Añadir gráficos</div>
          <div style={{ fontSize:11, color:C.textMuted, marginBottom:16 }}>Toca o arrastra al panel</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {WIDGET_CATALOG.map(w => (
              <div key={w.type}
                draggable
                onDragStart={()=>{dragItem.current='ADD:'+w.type}}
                onClick={()=>addWidget(w.type)}
                style={{ border:`1px solid ${C.border}`, borderRadius:6, padding:'10px 12px', cursor:'pointer', background:usedTypes.has(w.type)?C.gridBg:C.white, transition:'all .15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:18 }}>{w.icon}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{w.name}</div>
                    <div style={{ fontSize:10, color:C.textMuted, lineHeight:1.3 }}>{w.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={()=>setLayout(DEFAULT_LAYOUT)} style={{ marginTop:16, width:'100%', padding:'8px', border:`1px solid ${C.border}`, borderRadius:4, background:C.gridBg, color:C.textMuted, fontSize:12, cursor:'pointer' }}>Restablecer panel</button>
        </div>
      )}
    </div>
  )
}
