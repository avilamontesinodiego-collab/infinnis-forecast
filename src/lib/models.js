export function movingAverage(data,excl,w=3){const cl=data.map((v,i)=>excl.has(i)?null:v);return data.map((_,i)=>{if(excl.has(i))return null;let s=0,c=0;for(let j=0;j<w&&i-j>=0;j++)if(cl[i-j]!==null){s+=cl[i-j];c++}return c>=2?s/c:null})}
export function expSmooth(data,excl,a=0.3){const r=[];let p=null;for(let i=0;i<data.length;i++){if(excl.has(i)){r.push(p);continue}if(p===null){p=data[i];r.push(data[i]);continue}p=a*data[i]+(1-a)*p;r.push(p)}return r}
export function linReg(data,excl){const pts=[];for(let i=0;i<data.length;i++)if(!excl.has(i))pts.push({x:i,y:data[i]});const n=pts.length;if(n<2)return{fitted:data.map(()=>null),future:Array(6).fill(null),slope:0,intercept:0};let sx=0,sy=0,sxy=0,sx2=0;for(const p of pts){sx+=p.x;sy+=p.y;sxy+=p.x*p.y;sx2+=p.x*p.x}const sl=(n*sxy-sx*sy)/(n*sx2-sx*sx),ic=(sy-sl*sx)/n;return{fitted:data.map((_,i)=>ic+sl*i),future:Array.from({length:6},(_,i)=>ic+sl*(data.length+i)),slope:sl,intercept:ic}}
export function holtWinters(data,excl,a=.35,b=.1,g=.25,m=12){const cl=data.map((v,i)=>excl.has(i)?null:v);const vl=cl.filter(v=>v!==null);if(vl.length<m+2)return null;let cnt=0,sum=0;for(let i=0;i<Math.min(m,data.length);i++)if(cl[i]!==null){sum+=cl[i];cnt++}let lv=cnt>0?sum/cnt:vl[0];let tr=0,pr=0;for(let i=0;i<m&&i+m<data.length;i++)if(cl[i]!==null&&cl[i+m]!==null){tr+=(cl[i+m]-cl[i])/m;pr++}tr=pr>0?tr/pr:0;const sn=[];for(let i=0;i<m;i++)sn.push(cl[i]!==null?cl[i]-lv:0);const ft=[];for(let i=0;i<data.length;i++){const si=i%m;ft.push(lv+tr+sn[si]);if(cl[i]!==null){const pl=lv;lv=a*(cl[i]-sn[si])+(1-a)*(lv+tr);tr=b*(lv-pl)+(1-b)*tr;sn[si]=g*(cl[i]-lv)+(1-g)*sn[si]}}const fu=[];for(let i=1;i<=6;i++)fu.push(lv+tr*i+sn[(data.length+i-1)%m]);return{fitted:ft,future:fu}}
export function calcMAPE(a,p,ex){let s=0,c=0;for(let i=0;i<a.length;i++){if(ex.has(i))continue;if(p[i]!=null&&a[i]!==0){s+=Math.abs((a[i]-p[i])/a[i]);c++}}return c>0?(s/c)*100:999}
export function calcR2(a,p,ex){const pr=[];for(let i=0;i<a.length;i++){if(ex.has(i))continue;if(p[i]!=null)pr.push({a:a[i],p:p[i]})}if(pr.length<2)return 0;const mn=pr.reduce((s,x)=>s+x.a,0)/pr.length;const st=pr.reduce((s,x)=>s+(x.a-mn)**2,0);const sr=pr.reduce((s,x)=>s+(x.a-x.p)**2,0);return st>0?Math.max(0,1-sr/st):0}
export function detectOutliers(data){const sorted=[...data].sort((a,b)=>a-b);const q1=sorted[Math.floor(sorted.length*.25)],q3=sorted[Math.floor(sorted.length*.75)],iqr=q3-q1;const lo=q1-1.5*iqr,hi=q3+1.5*iqr;const o=new Set();for(let i=0;i<data.length;i++){if(data[i]<lo||data[i]>hi)o.add(i);if(i>0&&i<data.length-1){const avg=(data[i-1]+data[i+1])/2;if(Math.abs(data[i]-avg)/avg>.25)o.add(i)}}return o}

export function bestForecast(values, excluded = new Set()) {
  const ma = movingAverage(values, excluded, 3), es = expSmooth(values, excluded, .3), lr = linReg(values, excluded), hw = holtWinters(values, excluded)
  const r = {}
  r['Media Móvil (3)'] = { fitted: ma, future: lr.future }
  r['Suavizado Exponencial'] = { fitted: es, future: lr.future }
  r['Regresión Lineal'] = { fitted: lr.fitted, future: lr.future }
  if (hw) r['Holt-Winters'] = { fitted: hw.fitted, future: hw.future }
  let best = null, bestRel = -1
  for (const [name, m] of Object.entries(r)) {
    const mape = calcMAPE(values, m.fitted, excluded)
    const rel = Math.max(0, Math.min(100, 100 - mape))
    const r2 = calcR2(values, m.fitted, excluded)
    if (rel > bestRel) { bestRel = rel; best = { name, mape, r2, reliability: rel, future: m.future } }
  }
  return best
}
