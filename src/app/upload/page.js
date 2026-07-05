'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/layout'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import * as XLSX from 'xlsx'

const C = { header:'#003c71', accent:'#0078d4', accentLight:'#cce4f7', border:'#c8d6e5', borderLight:'#dfe6ed', text:'#1a2b3c', textMuted:'#5a6f82', gridBg:'#f7f9fc', green:'#0b8043', greenBg:'#e6f4ea', red:'#c5221f', redBg:'#fce8e6', orange:'#e37400', orangeBg:'#fef3e0', white:'#fff' }

const MES_MAP = { ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12,
  jan:1,apr:4,aug:8,dec:12 }

function parseMesOrd(label, fallback) {
  if (typeof label !== 'string') return fallback
  const m = label.toLowerCase().match(/([a-z]{3})[a-z]*[\s\-\/]*(\d{2,4})/)
  if (m && MES_MAP[m[1]]) {
    let y = parseInt(m[2]); if (y < 100) y += 2000
    return y * 100 + MES_MAP[m[1]]
  }
  return fallback
}

export default function UploadPage() {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const [rows, setRows] = useState([])       // long format: {referencia, descripcion, mes, mes_ord, ventas_kg}
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [replace, setReplace] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading, router])
  if (loading || !user) return null

  function handleFile(e) {
    setError(''); setSaved(false)
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
        if (aoa.length < 2) { setError('Archivo vacío o sin datos'); return }

        const header = aoa[0].map(h => (h == null ? '' : String(h).trim()))
        const lower = header.map(h => h.toLowerCase())
        const refCol = lower.findIndex(h => /ref|sku|c[oó]digo|art[ií]culo/.test(h))
        const descCol = lower.findIndex(h => /desc|nombre|producto/.test(h))
        const mesCol = lower.findIndex(h => /^mes$|periodo|fecha/.test(h))
        const ventasCol = lower.findIndex(h => /venta|kg|cantidad|unidades|qty/.test(h))

        const out = []
        if (mesCol >= 0 && ventasCol >= 0 && refCol >= 0) {
          // LONG format
          for (let i = 1; i < aoa.length; i++) {
            const r = aoa[i]; if (!r || r[refCol] == null) continue
            const mes = String(r[mesCol] ?? '')
            out.push({
              referencia: String(r[refCol]).trim(),
              descripcion: descCol >= 0 ? String(r[descCol] ?? '').trim() : '',
              mes, mes_ord: parseMesOrd(mes, i),
              ventas_kg: Number(r[ventasCol]) || 0
            })
          }
        } else if (refCol >= 0) {
          // WIDE format: month columns are everything except ref/desc
          const monthCols = header.map((h, idx) => ({ h, idx }))
            .filter(c => c.idx !== refCol && c.idx !== descCol && c.h !== '')
          for (let i = 1; i < aoa.length; i++) {
            const r = aoa[i]; if (!r || r[refCol] == null) continue
            for (const mc of monthCols) {
              const val = r[mc.idx]
              if (val == null || val === '') continue
              out.push({
                referencia: String(r[refCol]).trim(),
                descripcion: descCol >= 0 ? String(r[descCol] ?? '').trim() : '',
                mes: mc.h, mes_ord: parseMesOrd(mc.h, mc.idx),
                ventas_kg: Number(val) || 0
              })
            }
          }
        } else {
          setError('No encuentro columna de Referencia. Cabeceras esperadas: Referencia, Descripción, y meses (Ene-25...) o columnas Mes + Ventas.')
          return
        }

        if (out.length === 0) { setError('No se pudieron leer filas válidas'); return }
        const refs = new Set(out.map(o => o.referencia))
        setRows(out)
        setStats({ filas: out.length, refs: refs.size, refList: [...refs] })
      } catch (err) {
        setError('Error leyendo Excel: ' + err.message)
      }
    }
    reader.readAsBinaryString(file)
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const batch = crypto.randomUUID()
      if (replace) {
        const refs = [...new Set(rows.map(r => r.referencia))]
        await supabase.from('ventas_reales').delete().in('referencia', refs)
      }
      const payload = rows.map(r => ({ ...r, upload_batch: batch, uploaded_by: user.id }))
      // insert in chunks of 500
      for (let i = 0; i < payload.length; i += 500) {
        const chunk = payload.slice(i, i + 500)
        const { error } = await supabase.from('ventas_reales').insert(chunk)
        if (error) throw error
      }
      setSaved(true); setRows([]); setStats(null); setFileName('')
    } catch (err) {
      setError('Error guardando: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#eef2f7' }}>
      <Navbar />
      <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ background: C.header, color: '#fff', padding: '12px 20px', fontSize: 14, fontWeight: 600 }}>Cargar Serie de Ventas (Excel)</div>
          <div style={{ padding: 24 }}>
            <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
              Sube un Excel con tus ventas históricas por referencia. Formatos aceptados:<br/>
              <b>Ancho:</b> columnas <code>Referencia · Descripción · Ene-25 · Feb-25 · …</code><br/>
              <b>Largo:</b> columnas <code>Referencia · Descripción · Mes · Ventas</code>
            </p>

            <label style={{ display: 'inline-block', padding: '10px 20px', background: C.accent, color: '#fff', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Seleccionar archivo Excel
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
            </label>
            {fileName && <span style={{ marginLeft: 12, fontSize: 13, color: C.textMuted }}>{fileName}</span>}

            {error && <div style={{ marginTop: 16, background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 4, padding: '10px 14px', fontSize: 13, color: C.red }}>{error}</div>}
            {saved && <div style={{ marginTop: 16, background: C.greenBg, border: `1px solid ${C.green}`, borderRadius: 4, padding: '10px 14px', fontSize: 13, color: C.green }}>✓ Datos guardados en la base de datos correctamente.</div>}
          </div>
        </div>

        {stats && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ background: C.header, color: '#fff', padding: '12px 20px', fontSize: 14, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Vista previa</span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{stats.filas} filas · {stats.refs} referencias</span>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {stats.refList.slice(0, 20).map(r => <span key={r} style={{ fontSize: 11, padding: '3px 10px', background: C.accentLight, color: C.header, borderRadius: 3, fontWeight: 600 }}>{r}</span>)}
                {stats.refList.length > 20 && <span style={{ fontSize: 11, color: C.textMuted }}>+{stats.refList.length - 20} más</span>}
              </div>
              <div style={{ maxHeight: 300, overflow: 'auto', border: `1px solid ${C.borderLight}`, borderRadius: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: C.gridBg, position: 'sticky', top: 0 }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Referencia</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Descripción</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Mes</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Ventas</th>
                  </tr></thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? C.gridBg : C.white }}>
                        <td style={{ padding: '7px 12px' }}>{r.referencia}</td>
                        <td style={{ padding: '7px 12px', color: C.textMuted }}>{r.descripcion}</td>
                        <td style={{ padding: '7px 12px' }}>{r.mes}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.ventas_kg.toLocaleString('es-ES')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text }}>
                  <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />
                  Reemplazar datos existentes de estas referencias
                </label>
                <button onClick={save} disabled={saving}
                  style={{ padding: '10px 28px', background: C.green, color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Guardando...' : 'Guardar en base de datos'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
