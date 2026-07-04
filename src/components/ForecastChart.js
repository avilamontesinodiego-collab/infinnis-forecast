'use client'
import { useState, useMemo, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area } from 'recharts'

const C = { bg:'#eef2f7',white:'#ffffff',header:'#003c71',headerLight:'#00508f',accent:'#0078d4',accentLight:'#cce4f7',accentDark:'#002855',border:'#c8d6e5',borderLight:'#dfe6ed',text:'#1a2b3c',textMuted:'#5a6f82',textLight:'#8a9bac',gridBg:'#f7f9fc',green:'#0b8043',greenBg:'#e6f4ea',red:'#c5221f',redBg:'#fce8e6',orange:'#e37400',orangeBg:'#fef3e0',purple:'#7b1fa2' }

function movingAverage(data,excl,w=3){const cl=data.map((v,i)=>excl.has(i)?null:v);return data.map((_,i)=>{if(excl.has(i))return null;let s=0,c=0;for(let j=0;j<w&&i-j>=0;j++)if(cl[i-j]!==null){s+=cl[i-j];c++}return c>=2?s/c:null})}
function expSmooth(data,excl,a=0.3){const r=[];let p=null;for(let i=0;i<data.length;i++){if(excl.has(i)){r.push(p);continue}if(p===null){p=data[i];r.push(data[i]);continue}p=a*data[i]+(1-a)*p;r.push(p)}return r}
function linReg(data,excl){const pts=[];for(let i=0;i<data.length;i++)if(!excl.has(i))pts.push({x:i,y:data[i]});const n=pts.length;if(n<2)return{fitted:data.map(()=>null),future:Array(6).fill(null),slope:0,intercept:0};let sx=0,sy=0,sxy=0,sx2=0;for(const p of pts){sx+=p.x;sy+=p.y;sxy+=p.x*p.y;sx2+=p.x*p.x}const sl=(n*sxy-sx*sy)/(n*sx2-sx*sx),ic=(sy-sl*sx)/n;return{fitted:data.map((_,i)=>ic+sl*i),future:Array.from({length:6},(_,i)=>ic+sl*(data.length+i)),slope:sl,intercept:ic}}
function holtWinters(data,excl,a=.35,b=.1,g=.25,m=12){const cl=data.map((v,i)=>excl.has(i)?null:v);const vl=cl.filter(v=>v!==null);if(vl.length<m+2)return null;let cnt=0,sum=0;for(let i=0;i<Math.min(m,data.length);i++)if(cl[i]!==null){sum+=cl[i];cnt++}let lv=cnt>0?sum/cnt:vl[0];let tr=0,pr=0;for(let i=0;i<m&&i+m<data.length;i++)if(cl[i]!==null&&cl[i+m]!==null){tr+=(cl[i+m]-cl[i])/m;pr++}tr=pr>0?tr/pr:0;const sn=[];for(let i=0;i<m;i++)sn.push(cl[i]!==null?cl[i]-lv:0);const ft=[];for(let i=0;i<data.length;i++){const si=i%m;ft.push(lv+tr+sn[si]);if(cl[i]!==null){const pl=lv;lv=a*(cl[i]-sn[si])+(1-a)*(lv+tr);tr=b*(lv-pl)+(1-b)*tr;sn[si]=g*(cl[i]-lv)+(1-g)*sn[si]}}const fu=[];for(let i=1;i<=6;i++)fu.push(lv+tr*i+sn[(data.length+i-1)%m]);return{fitted:ft,future:fu}}
function calcMAPE(a,p,ex){let s=0,c=0;for(let i=0;i<a.length;i++){if(ex.has(i))continue;if(p[i]!=null&&a[i]!==0){s+=Math.abs((a[i]-p[i])/a[i]);c++}}return c>0?(s/c)*100:999}
function calcR2(a,p,ex){const pr=[];for(let i=0;i<a.length;i++){if(ex.has(i))continue;if(p[i]!=null)pr.push({a:a[i],p:p[i]})}if(pr.length<2)return 0;const mn=pr.reduce((s,x)=>s+x.a,0)/pr.length;const st=pr.reduce((s,x)=>s+(x.a-mn)**2,0);const sr=pr.reduce((s,x)=>s+(x.a-x.p)**2,0);return st>0?Math.max(0,1-sr/st):0}
function detectOutliers(data){const sorted=[...data].sort((a,b)=>a-b);const q1=sorted[Math.floor(sorted.length*.25)],q3=sorted[Math.floor(sorted.length*.75)],iqr=q3-q1;const lo=q1-1.5*iqr,hi=q3+1.5*iqr;const o=new Set();for(let i=0;i<data.length;i++){if(data[i]<lo||data[i]>hi)o.add(i);if(i>0&&i<data.length-1){const avg=(data[i-1]+data[i+1])/2;if(Math.abs(data[i]-avg)/avg>.25)o.add(i)}}return o}

const sampleData = {
  name:'Detergente Industrial X-200', unit:'Tn',
  values:[120,135,150,142,160,155,130,125,170,185,195,210,130,148,280,155,175,168,142,138,185,200,320,230],
  months:['Ene-25','Feb-25','Mar-25','Abr-25','May-25','Jun-25','Jul-25','Ago-25','Sep-25','Oct-25','Nov-25','Dic-25','Ene-26','Feb-26','Mar-26','Abr-26','May-26','Jun-26','Jul-26','Ago-26','Sep-26','Oct-26','Nov-26','Dic-26']
}
const futureMonths = ['Ene-27','Feb-27','Mar-27','Abr-27','May-27','Jun-27']

function NavTooltip({active,payload,label}){
  if(!active||!payload?.length)return null
  return(<div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:'10px 14px',boxShadow:'0 2px 8px rgba(0,0,0,0.12)',fontSize:13}}>
    <div style={{fontWeight:600,color:C.text,marginBottom:6}}>{label}</div>
    {payload.map((p,i)=>p.value!=null&&<div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}><span style={{width:10,height:10,borderRadius:2,background:p.color,display:'inline-block'}}/><span style={{color:C.textMuted}}>{p.name}:</span><span style={{fontWeight:600,color:C.text}}>{Math.round(p.value)}</span></div>)}
  </div>)
}

export default function ForecastChart() {
  const [excluded, setExcluded] = useState(new Set())
  const [activeModel, setActiveModel] = useState('auto')
  const [showSuggestions, setShowSuggestions] = useState(true)

  const suggestedOutliers = useMemo(() => detectOutliers(sampleData.values), [])
  const toggleExclude = useCallback(idx => { setExcluded(prev => { const n = new Set(prev); n.has(idx)?n.delete(idx):n.add(idx); return n }) }, [])
  const excludeAll = useCallback(() => { setExcluded(new Set(suggestedOutliers)); setShowSuggestions(false) }, [suggestedOutliers])
  const clearAll = useCallback(() => { setExcluded(new Set()); setShowSuggestions(true) }, [])

  const models = useMemo(() => {
    const d = sampleData.values
    const ma = movingAverage(d,excluded,3), es = expSmooth(d,excluded,.3), lr = linReg(d,excluded), hw = holtWinters(d,excluded)
    const vMA = ma.filter(v=>v!==null), lastMA = vMA.length?vMA[vMA.length-1]:d[d.length-1]
    const vES = es.filter(v=>v!==null), lastES = vES.length?vES[vES.length-1]:d[d.length-1]
    const r = {}
    r.ma = { name:'Media Móvil (3)', fitted:ma, future:Array.from({length:6},(_,i)=>lastMA*(1+lr.slope/Math.max(1,lr.intercept+lr.slope*d.length)*(i+1))), color:'#0078d4' }
    r.es = { name:'Suavizado Exponencial', fitted:es, future:Array.from({length:6},(_,i)=>lastES*(1+lr.slope/Math.max(1,lr.intercept+lr.slope*d.length)*(i+1))), color:C.orange }
    r.lr = { name:'Regresión Lineal', fitted:lr.fitted, future:lr.future, color:C.green }
    if(hw) r.hw = { name:'Holt-Winters', fitted:hw.fitted, future:hw.future, color:C.purple }
    for(const m of Object.values(r)){ m.mape=calcMAPE(d,m.fitted,excluded); m.r2=calcR2(d,m.fitted,excluded); m.reliability=Math.max(0,Math.min(100,100-m.mape)) }
    let bk='lr',bs=-1; for(const[k,m]of Object.entries(r))if(m.reliability>bs){bs=m.reliability;bk=k}
    r._best=bk; return r
  }, [excluded])

  const bestKey = models._best
  const selected = activeModel==='auto' ? bestKey : (models[activeModel]?activeModel:bestKey)
  const sel = models[selected]

  const chartData = useMemo(() => {
    const d = sampleData.values, rows = []
    for(let i=0;i<d.length;i++) rows.push({ month:sampleData.months[i], real:excluded.has(i)?null:d[i], excluded:excluded.has(i)?d[i]:null, outlier:suggestedOutliers.has(i)&&!excluded.has(i)?d[i]:null, forecast:sel.fitted[i]!=null?Math.round(sel.fitted[i]):null })
    for(let i=0;i<6;i++) rows.push({ month:futureMonths[i], real:null, excluded:null, outlier:null, forecast:Math.round(sel.future[i]) })
    return rows
  }, [selected, excluded, models, sel, suggestedOutliers])

  const rc = r => r>=85?C.green:r>=70?C.orange:C.red
  const rl = r => r>=85?'EXCELENTE':r>=70?'BUENO':r>=50?'ACEPTABLE':'BAJO'

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* Toolbar */}
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:4, padding:'8px 16px', marginBottom:16, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:12, color:C.textMuted, marginRight:8 }}>Modelo:</span>
        {[{key:'auto',label:'Automático'},{key:'ma',label:'Media Móvil'},{key:'es',label:'Suav. Exp.'},{key:'lr',label:'Regresión'},...(models.hw?[{key:'hw',label:'Holt-Winters'}]:[])].map(b=>
          <button key={b.key} onClick={()=>setActiveModel(b.key)} style={{ padding:'5px 14px',borderRadius:3,fontSize:12,fontWeight:500,border:`1px solid ${activeModel===b.key?C.accent:C.border}`,background:activeModel===b.key?C.accentLight:C.white,color:activeModel===b.key?C.accentDark:C.text }}>{b.label}{b.key==='auto'?` (${models[bestKey].name})`:''}</button>
        )}
        <div style={{flex:1}}/>
        <span style={{fontSize:11,color:C.textMuted}}>{excluded.size} excluidos</span>
        {excluded.size>0&&<button onClick={clearAll} style={{padding:'4px 10px',fontSize:11,border:`1px solid ${C.border}`,borderRadius:3,background:C.white,color:C.red}}>Restaurar</button>}
      </div>

      {/* Outlier banner */}
      {showSuggestions && suggestedOutliers.size>0 && excluded.size===0 && (
        <div style={{background:C.orangeBg,border:`1px solid ${C.orange}`,borderRadius:4,padding:'12px 18px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          <div>
            <span style={{fontWeight:600,color:C.orange,fontSize:13}}>⚠ {suggestedOutliers.size} posibles outliers detectados</span>
            <span style={{color:C.textMuted,fontSize:12,marginLeft:8}}>({[...suggestedOutliers].map(i=>sampleData.months[i]).join(', ')})</span>
            <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Pueden ser promociones o pedidos extraordinarios. Excluirlos mejora la fiabilidad.</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={excludeAll} style={{padding:'6px 14px',fontSize:12,fontWeight:600,border:'none',borderRadius:3,background:C.orange,color:'#fff'}}>Excluir todos</button>
            <button onClick={()=>setShowSuggestions(false)} style={{padding:'6px 14px',fontSize:12,border:`1px solid ${C.border}`,borderRadius:3,background:C.white,color:C.textMuted}}>Ignorar</button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:12,marginBottom:16}}>
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:16,borderTop:`3px solid ${rc(sel.reliability)}`}}>
          <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase',letterSpacing:.5}}>Fiabilidad</div>
          <div style={{fontSize:32,fontWeight:700,color:rc(sel.reliability),lineHeight:1.2,marginTop:4}}>{Math.round(sel.reliability)}%</div>
          <div style={{fontSize:11,fontWeight:600,color:rc(sel.reliability),marginTop:2}}>{rl(sel.reliability)}</div>
        </div>
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:16,borderTop:`3px solid ${C.accent}`}}>
          <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase',letterSpacing:.5}}>R² (Ajuste)</div>
          <div style={{fontSize:32,fontWeight:700,color:C.text,lineHeight:1.2,marginTop:4}}>{(sel.r2*100).toFixed(1)}%</div>
          <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Varianza explicada</div>
        </div>
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:16,borderTop:`3px solid ${sel.mape<10?C.green:sel.mape<20?C.orange:C.red}`}}>
          <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase',letterSpacing:.5}}>MAPE</div>
          <div style={{fontSize:32,fontWeight:700,color:C.text,lineHeight:1.2,marginTop:4}}>{sel.mape.toFixed(1)}%</div>
          <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Error medio %</div>
        </div>
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:16,borderTop:`3px solid ${sel.color}`}}>
          <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase',letterSpacing:.5}}>Modelo</div>
          <div style={{fontSize:16,fontWeight:700,color:C.text,lineHeight:1.3,marginTop:6}}>{sel.name}</div>
          {selected===bestKey&&<div style={{fontSize:11,color:C.green,fontWeight:600,marginTop:2}}>★ Mejor</div>}
        </div>
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:16,borderTop:`3px solid ${C.accent}`}}>
          <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase',letterSpacing:.5}}>Próximo mes</div>
          <div style={{fontSize:32,fontWeight:700,color:C.accent,lineHeight:1.2,marginTop:4}}>{Math.round(sel.future[0])}</div>
          <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{futureMonths[0]} · {sampleData.unit}</div>
        </div>
      </div>

      {/* Chart */}
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,padding:'16px 16px 8px',marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:12}}>{sel.name} — Histórico + Pronóstico</div>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={chartData} margin={{top:5,right:20,bottom:5,left:10}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight}/>
            <XAxis dataKey="month" tick={{fontSize:10,fill:C.textMuted}} angle={-45} textAnchor="end" height={55}/>
            <YAxis tick={{fontSize:11,fill:C.textMuted}}/>
            <Tooltip content={<NavTooltip/>}/>
            <Legend wrapperStyle={{fontSize:12}}/>
            <Area type="monotone" dataKey="forecast" fill={sel.color} fillOpacity={.06} stroke="none" legendType="none"/>
            <Line type="monotone" dataKey="real" name="Ventas reales" stroke={C.header} strokeWidth={2.5} dot={{r:4,fill:C.header,stroke:'#fff',strokeWidth:2}} connectNulls={false}/>
            <Line type="monotone" dataKey="forecast" name={sel.name} stroke={sel.color} strokeWidth={2} strokeDasharray="6 3" dot={{r:3,fill:sel.color}}/>
            <Line type="monotone" dataKey="excluded" name="Excluido" stroke={C.textLight} strokeWidth={0} dot={{r:6,fill:C.textLight,stroke:'#fff',strokeWidth:2}} connectNulls={false} legendType="none"/>
            <Line type="monotone" dataKey="outlier" name="Outlier" stroke={C.orange} strokeWidth={0} dot={{r:7,fill:C.orange,stroke:'#fff',strokeWidth:2}} connectNulls={false}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Tables */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* Models */}
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

        {/* Data grid */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,overflow:'hidden'}}>
          <div style={{background:C.header,color:'#fff',padding:'10px 16px',fontSize:13,fontWeight:600,display:'flex',justifyContent:'space-between'}}>
            <span>Datos Históricos</span><span style={{fontSize:11,opacity:.7}}>Click = excluir</span>
          </div>
          <div style={{maxHeight:300,overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:C.gridBg,position:'sticky',top:0}}>
                <th style={{textAlign:'left',padding:'7px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Mes</th>
                <th style={{textAlign:'right',padding:'7px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Real</th>
                <th style={{textAlign:'right',padding:'7px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Fcst</th>
                <th style={{textAlign:'right',padding:'7px 12px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Err%</th>
                <th style={{textAlign:'center',padding:'7px 8px',color:C.textMuted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Est</th>
              </tr></thead>
              <tbody>
                {sampleData.values.map((v,i)=>{
                  const isEx=excluded.has(i),isOu=suggestedOutliers.has(i),ft=sel.fitted[i]
                  const err=ft!=null&&!isEx?((v-ft)/v*100):null
                  return(<tr key={i} onClick={()=>toggleExclude(i)} style={{background:isEx?C.redBg:isOu?C.orangeBg:i%2===0?C.white:C.gridBg,cursor:'pointer',opacity:isEx?.5:1,transition:'all .15s'}}>
                    <td style={{padding:'7px 12px'}}>{sampleData.months[i]}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',fontWeight:600,fontVariantNumeric:'tabular-nums',textDecoration:isEx?'line-through':'none'}}>{v}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',color:C.textMuted,fontVariantNumeric:'tabular-nums'}}>{ft!=null?Math.round(ft):'—'}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',fontVariantNumeric:'tabular-nums',color:err!=null?(Math.abs(err)<10?C.green:Math.abs(err)<20?C.orange:C.red):C.textLight}}>{err!=null?`${err>0?'+':''}${err.toFixed(1)}%`:'—'}</td>
                    <td style={{padding:'7px 8px',textAlign:'center'}}>{isEx?<span style={{color:C.red,fontSize:10,fontWeight:600}}>✕</span>:isOu?<span style={{color:C.orange,fontSize:10,fontWeight:600}}>⚠</span>:<span style={{color:C.green,fontSize:10}}>✓</span>}</td>
                  </tr>)
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Forecast cards */}
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:4,overflow:'hidden',marginTop:16}}>
        <div style={{background:C.header,color:'#fff',padding:'10px 16px',fontSize:13,fontWeight:600}}>Pronóstico 6 Meses — {sel.name} · Fiabilidad {Math.round(sel.reliability)}%</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(6, 1fr)'}}>
          {futureMonths.map((m,i)=>{
            const val=Math.round(sel.future[i]),py=sampleData.values[i],pct=Math.round(((val-py)/py)*100)
            return(<div key={m} style={{padding:14,textAlign:'center',borderRight:i<5?`1px solid ${C.borderLight}`:'none'}}>
              <div style={{fontSize:11,color:C.textMuted,fontWeight:600,marginBottom:4}}>{m}</div>
              <div style={{fontSize:26,fontWeight:700,color:C.accentDark}}>{val}</div>
              <div style={{fontSize:10,color:C.textMuted}}>{sampleData.unit}</div>
              <div style={{fontSize:12,fontWeight:600,color:pct>=0?C.green:C.red,marginTop:4}}>{pct>=0?'▲':'▼'} {Math.abs(pct)}%</div>
            </div>)
          })}
        </div>
      </div>

      <div style={{textAlign:'center',color:C.textLight,fontSize:11,padding:'14px 0'}}>Infinnis Forecast Engine v2.0 · Detección outliers · Selección MAPE + R²</div>
    </div>
  )
}
