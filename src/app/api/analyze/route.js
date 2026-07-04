import Anthropic from '@anthropic-ai/sdk'

export async function POST(req) {
  try {
    const { sku, values, months, excluded, model, forecast, mape, r2, reliability, question } = await req.json()

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const context = `Eres un experto en operaciones y forecasting industrial. Analiza demanda con criterio de S&OP.

SKU: ${sku.name} (${sku.id})
Familia: ${sku.family}
Unidad: ${sku.unit}

Histórico 24 meses:
${months.map((m, i) => `${m}: ${values[i]}${excluded.includes(i) ? ' [EXCLUIDO]' : ''}`).join('\n')}

Modelo activo: ${model}
Fiabilidad: ${reliability}%
R²: ${r2}%
MAPE: ${mape}%

Pronóstico 6 meses: ${forecast.join(', ')}

Datos excluidos por outlier/promo: ${excluded.length > 0 ? excluded.map(i => months[i]).join(', ') : 'ninguno'}
`

    const userMsg = question || 'Analiza el comportamiento de la demanda. Detecta tendencias, estacionalidad, riesgos. Da 3 recomendaciones concretas al equipo de operaciones. Sé breve y directo.'

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: context,
      messages: [{ role: 'user', content: userMsg }]
    })

    return Response.json({ text: response.content[0].text })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
