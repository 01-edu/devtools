import { promptTemplate } from '/api/fix-query-prompt.ts'
import { GEMINI_API_KEY, GEMINI_MODEL } from '/api/lib/env.ts'

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=json&key=${GEMINI_API_KEY}`

export async function analyzeQueryWithAI(metric: unknown, schema: unknown) {
  const payload = JSON.stringify({ schema, metrics: [metric] }, null, 2)
  const prompt = promptTemplate.replace('{{QUERY_METRICS_JSON}}', payload)

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

  return chunks
    .flatMap((chunk) => chunk.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
}
