import { supabase } from '@/lib/supabase'

// Fetch distinct references stored in ventas_reales
export async function getReferences() {
  const { data, error } = await supabase
    .from('ventas_reales')
    .select('referencia, descripcion')
    .order('referencia')
  if (error || !data) return []
  const map = new Map()
  for (const r of data) if (!map.has(r.referencia)) map.set(r.referencia, r.descripcion || r.referencia)
  return [...map.entries()].map(([id, name]) => ({ id, name }))
}

// Fetch time series for one reference, ordered by month
export async function getSeries(referencia) {
  const { data, error } = await supabase
    .from('ventas_reales')
    .select('mes, mes_ord, ventas_kg, descripcion')
    .eq('referencia', referencia)
    .order('mes_ord')
  if (error || !data || data.length === 0) return null
  return {
    id: referencia,
    name: data[0].descripcion || referencia,
    unit: 'Kg',
    months: data.map(r => r.mes),
    values: data.map(r => Number(r.ventas_kg) || 0)
  }
}
