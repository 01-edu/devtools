import { render } from '@deno/gfm'
import { promptTemplate } from '/api/fix-query-prompt.ts'
import { GEMINI_API_KEY, GEMINI_MODEL } from '/api/lib/env.ts'
import { AIAnalysisCacheCollection } from '/api/schema.ts'

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=json&key=${GEMINI_API_KEY}`

const encoder = new TextEncoder()
async function sha(message: string) {
  const data = encoder.encode(message)
  const buff = await crypto.subtle.digest('SHA-1', data)
  return new Uint8Array(buff).toHex()
}

type Metric = { query: string; explain: unknown; status: unknown }

function cacheKey(deployment: string, metric: Metric) {
  return sha(
    JSON.stringify({
      deployment,
      query: metric.query,
      explain: metric.explain,
      status: metric.status,
    }),
  )
}

async function callGemini(payload: string, thinkingLevel: string) {
  const prompt = promptTemplate.replace('{{QUERY_DETAILS_JSON}}', payload)

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { thinkingConfig: { thinkingLevel } },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${body}`)
  }

  // streamGenerateContent with alt=json returns a JSON array of response chunks
  const chunks: {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }[] = await res.json()

  const markdown = chunks
    .flatMap((chunk) => chunk.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')

  return render(markdown)
}

export async function analyzeQueryWithAI(
  deployment: string,
  metric: Metric,
  schema: unknown,
  forceRefresh = false,
) {
  const key = await cacheKey(deployment, metric)
  const cached = !forceRefresh && AIAnalysisCacheCollection.get(key)
  if (cached) return cached.analysis

  const payload = JSON.stringify({ schema, metrics: [metric] }, null, 2)
  const analysis = await callGemini(payload, forceRefresh ? 'HIGH' : 'MINIMAL')

  const existing = AIAnalysisCacheCollection.get(key)
  if (existing) {
    AIAnalysisCacheCollection.update(key, { analysis })
  } else {
    AIAnalysisCacheCollection.insert({ cacheKey: key, analysis })
  }
  return analysis
}
