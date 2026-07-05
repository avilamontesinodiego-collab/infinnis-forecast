import Anthropic from '@anthropic-ai/sdk'

export async function POST(req) {
  try {
    const { question, refsSummary, refCount, history } = await req.json()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const system = `Eres el Agente Forecast de Infinnis: un analista senior de operaciones y supply chain, experto en forecasting estadístico, S&OP, políticas de stock y aprovisionamiento para empresas industriales (química, cosmética, gran consumo).

Tienes acceso a ${refCount} referencias del cliente:
${refsSummary || '(sin datos cargados aún)'}

Reglas:
- Responde en español, directo y práctico, con criterio de operaciones real.
- Da recomendaciones concretas y accionables, no teoría genérica.
- Si detectas outliers o promociones, avisa que hay que limpiarlos antes de pronosticar.
- Cuando hables de forecast comercial vs estadístico, explica cómo medir el gap y el sesgo.
- Sé conciso. Usa listas cortas cuando ayude.`

    const messages = [...(history || []).map(h => ({ role: h.role, content: h.content })), { role: 'user', content: question }]

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1200,
      system,
      messages
    })

    return Response.json({ text: response.content[0].text })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
