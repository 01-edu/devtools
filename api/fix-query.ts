import { render } from '@deno/gfm'
import { promptTemplate } from '/api/fix-query-prompt.ts'
import { GEMINI_API_KEY, GEMINI_MODEL } from '/api/lib/env.ts'

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=json&key=${GEMINI_API_KEY}`

// In-memory cache keyed by SHA-1 of (deployment + query + explain + status).
// Survives for the lifetime of the server process.
const analysisCache = new Map<string, string>()
const encoder = new TextEncoder()
async function sha(message: string) {
  const data = encoder.encode(message)
  const buff = await crypto.subtle.digest('SHA-1', data)
  return new Uint8Array(buff).toHex()
}

function cacheKey(
  deployment: string,
  metric: { query: string; explain: unknown; status: unknown },
) {
  return sha(
    JSON.stringify({
      deployment,
      query: metric.query,
      explain: metric.explain,
      status: metric.status,
    }),
  )
}

export async function analyzeQueryWithAI(
  deployment: string,
  metric: { query: string; explain: unknown; status: unknown },
  schema: unknown,
  forceRefresh = false,
) {
  const key = await cacheKey(deployment, metric)
  if (!forceRefresh) {
    const cached = analysisCache.get(key)
    if (cached) return cached
  }

  const payload = JSON.stringify({ schema, metrics: [metric] }, null, 2)
  const prompt = promptTemplate.replace('{{QUERY_DETAILS_JSON}}', payload)

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        thinkingConfig: { thinkingLevel: 'MINIMAL' },
      },
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

  const analysis = render(markdown)
  analysisCache.set(key, analysis)
  return analysis
}
