'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/layout'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import * as XLSX from 'xlsx'

const C = { bg:'#eef2f7',white:'#ffffff',header:'#003c71',accent:'#0078d4',accentLight:'#cce4f7',accentDark:'#002855',border:'#c8d6e5',borderLight:'#dfe6ed',text:'#1a2b3c',textMuted:'#5a6f82',textLight:'#8a9bac',gridBg:'#f7f9fc',green:'#0b8043',greenBg:'#e6f4ea',red:'#c5221f',redBg:'#fce8e6',orange:'#e37400',orangeBg:'#fef3e0' }

export default function UploadPage() {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState([])

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading, router])
  useEffect(() => { if (user) fetchExisting() }, [user])

  async function fetchExisting() {
    const { data } = await supabase.from('sku_monthly').select('referencia,descripcion').limit(5000)
    if (data) {
      const uniq = {}
      data.forEach(r => { uniq[r.referencia] = r.descripcion })
      setExisting(Object.entries(uniq).map(([ref, desc]) => ({ ref, desc })))
    }
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setStatus('')
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 })
      parseData(json)
    }
    reader.readAsBinaryString(file)
  }

  function parseData(json) {
    if (!json.length) { setStatus('Archivo vacío'); return }
    const header = json[0].map(h => String(h).trim().toLowerCase())
    const parsed = []
    const refIdx = header.findIndex(h => h.includes('refer') || h.includes('sku') || h.includes('codigo') || h.includes('código'))
    const descIdx = header.findIndex(h => h.includes('desc') || h.includes('nombre'))
    const mesIdx = header.findIndex(h => h === 'mes' || h.includes('periodo') || h.includes('fecha'))
    const ventasIdx = header.findIndex(h => h.includes('venta') || h.includes('kg') || h.includes('cantidad') || h.includes('units') || h.includes('uds'))

    if (mesIdx >= 0 && ventasIdx >= 0 && refIdx >= 0) {
      for (let i = 1; i < json.length; i++) {
        const row = json[i]
        if (!row[refIdx]) continue
        parsed.push({
          referencia: String(row[refIdx]).trim(),
          descripcion: descIdx >= 0 ? String(row[descIdx] || '').trim() : '',
          mes: String(row[mesIdx]).trim(),
          ventas_kg: Number(row[ventasIdx]) || 0
        })
      }
    } else if (refIdx >= 0) {
      const monthCols = []
      for (let c = 0; c < header.length; c++) {
        if (c === refIdx || c === descIdx) continue
        if (header[c] && header[c] !== 'abc' && !header[c].includes('clase')) monthCols.push(c)
      }
      for (let i = 1; i < json.length; i++) {
        const row = json[i]
        if (!row[refIdx]) continue
        const ref = String(row[refIdx]).trim()
        const desc = descIdx >= 0 ? String(row[descIdx] || '').trim() : ''
        for (const c of monthCols) {
          const val = Number(row[c])
          if (!isNaN(val) && row[c] !== '' && row[c] != null) {
            parsed.push({ referencia: ref, descripcion: desc, mes: String(json[0][c]).trim(), ventas_kg: val })
          }
        }
      }
    } else {
      setStatus('No se detectan columnas. Necesito: Referencia, Mes, Ventas (o Referencia + columnas de meses)')
      return
    }

    setRows(parsed)
    setStatus(`${parsed.length} registros detectados · ${new Set(parsed.map(r => r.referencia)).size} referencias`)
  }

  async function save() {
    if (!rows.length) return
    setSaving(true)
    setStatus('Guardando...')
    const batch = crypto.randomUUID()
    const payload = rows.map(r => ({ ...r, upload_batch: batch, uploaded_by: user.id, uploaded_at: new Date().toISOString() }))
    let ok = 0
    for (let i = 0; i < payload.length; i += 500) {
      const chunk = payload.slice(i, i + 500)
      const { error } = await supabase.from('sku_monthly').insert(chunk)
      if (error) { setStatus(`Error: ${error.message}`); setSaving(false); return }
      ok += chunk.length
    }
    setStatus(`✓ ${ok} registros guardados en base de datos`)
    setRows([]); setFileName(''); fetchExisting(); setSaving(false)
  }

  if (loading || !user) return null
  const refsPreview = [...new Set(rows.map(r => r.referencia))].slice(0, 20)

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar />
      <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 4 }}>Subir Series de Ventas</h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Sube un Excel con tus ventas históricas por referencia. Quedan guardadas en la base de datos.</p>

        <div style={{ background: C.white, border: `2px dashed ${C.border}`, borderRadius: 8, padding: 32, textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <label style={{ display: 'inline-block', padding: '10px 24px', background: C.accent, color: '#fff', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Seleccionar archivo Excel
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
          </label>
          {fileName && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 12 }}>{fileName}</div>}
          <div style={{ fontSize: 11, color: C.textLight, marginTop: 12 }}>Formatos: Referencia + columnas de meses · o · Referencia, Mes, Ventas</div>
        </div>

        {status && (
          <div style={{ background: status.startsWith('✓') ? C.greenBg : status.startsWith('Error') || status.startsWith('No') ? C.redBg : C.orangeBg, border: `1px solid ${status.startsWith('✓') ? C.green : status.startsWith('Error') || status.startsWith('No') ? C.red : C.orange}`, borderRadius: 4, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: status.startsWith('✓') ? C.green : status.startsWith('Error') || status.startsWith('No') ? C.red : C.orange, fontWeight: 500 }}>{status}</div>
        )}

        {rows.length > 0 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ background: C.header, color: '#fff', padding: '10px 16px', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Vista previa ({refsPreview.length} primeras referencias)</span>
              <button onClick={save} disabled={saving} style={{ padding: '6px 20px', background: C.green, color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, opacity: saving ? 0.5 : 1 }}>{saving ? 'Guardando...' : '💾 Guardar en Base de Datos'}</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: C.gridBg }}>
                <th style={{ textAlign: 'left', padding: '8px 16px', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Referencia</th>
                <th style={{ textAlign: 'left', padding: '8px 16px', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Descripción</th>
                <th style={{ textAlign: 'right', padding: '8px 16px', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Nº meses</th>
              </tr></thead>
              <tbody>
                {refsPreview.map((ref, i) => {
                  const rRows = rows.filter(r => r.referencia === ref)
                  return (<tr key={ref} style={{ background: i % 2 === 0 ? C.white : C.gridBg }}>
                    <td style={{ padding: '8px 16px', fontWeight: 600 }}>{ref}</td>
                    <td style={{ padding: '8px 16px', color: C.textMuted }}>{rRows[0].descripcion || '—'}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{rRows.length}</td>
                  </tr>)
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ background: C.header, color: '#fff', padding: '10px 16px', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Referencias en Base de Datos</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{existing.length} referencias</span>
          </div>
          {existing.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>No hay datos aún. Sube tu primer Excel.</div>
          ) : (
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  {existing.map((e, i) => (
                    <tr key={e.ref} style={{ background: i % 2 === 0 ? C.white : C.gridBg, borderBottom: `1px solid ${C.borderLight}` }}>
                      <td style={{ padding: '8px 16px', fontWeight: 600, width: 160 }}>{e.ref}</td>
                      <td style={{ padding: '8px 16px', color: C.textMuted }}>{e.desc || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
