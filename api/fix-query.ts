import { render } from '@deno/gfm'
import { promptTemplate } from '/api/fix-query-prompt.ts'
import { fetchJson } from '/api/lib/fetcher.ts'
import { GEMINI_API_KEY, GEMINI_MODEL } from '/api/lib/env.ts'
import { AIAnalysisCacheCollection } from '/api/schema.ts'
import { log } from '/api/lib/logger.ts'
import { respond } from '@01edu/api/response'

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

  log.info('gemini-request-start', {
    thinkingLevel,
    promptLength: prompt.length,
  })

  try {
    const chunks = await fetchJson<{
      candidates?: {
        content?: { parts?: { text?: string }[] }
      }[]
    }[]>(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { thinkingConfig: { thinkingLevel } },
      }),
    })

    const markdown = chunks
      .flatMap((chunk) => chunk.candidates ?? [])
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('')

    return render(markdown)
  } catch (err) {
    log.error('gemini-request-failed', { error: err })
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new respond.InternalServerErrorError({
      message: `Gemini request failed: ${message}`,
      error: err,
    })
  }
}

export async function analyzeQueryWithAI(
  deployment: string,
  metric: Metric,
  schema: unknown,
  forceRefresh = false,
) {
  const key = await cacheKey(deployment, metric)
  const cached = !forceRefresh && AIAnalysisCacheCollection.get(key)
  if (cached) {
    log.info('ai-analysis-cache-hit', { deployment, query: metric.query })
    return cached.analysis
  }

  log.info('ai-analysis-start', {
    deployment,
    query: metric.query,
    forceRefresh,
  })

  const payload = JSON.stringify({ schema, metrics: [metric] }, null, 2)
  const analysis = await callGemini(payload, forceRefresh ? 'HIGH' : 'MINIMAL')

  const existing = AIAnalysisCacheCollection.get(key)
  if (existing) {
    AIAnalysisCacheCollection.update(key, { analysis })
  } else {
    AIAnalysisCacheCollection.insert({ cacheKey: key, analysis })
  }

  log.info('ai-analysis-complete', { deployment, query: metric.query })
  return analysis
}
