import { STORE_SECRET, STORE_URL } from '/api/lib/env.ts'

const headers = { authorization: `Bearer ${STORE_SECRET}` }
export const pending = new Set<Promise<unknown>>()
export const sync = () => Promise.all([...pending])
export const getOne = async <T>(
  path: string,
  id: string,
): Promise<T | null> => {
  const url = `${STORE_URL}/${path}/${encodeURIComponent(String(id))}`
  const res = await fetch(url, { headers })
  if (res.status === 404) return null
  return res.json()
}

export const set = (path: string, id: unknown, dt: unknown) => {
  const body = typeof dt === 'string' ? dt : JSON.stringify(dt)
  const p = fetch(
    `${STORE_URL}/${path}/${encodeURIComponent(String(id))}`,
    { method: 'POST', body, headers },
  )
  pending.add(p)
  p.finally(() => pending.delete(p))
  return 1
}

export const get = async <T>(
  path: string,
  params?: { q?: string; limit?: number; from?: number },
): Promise<T> => {
  const q = new URLSearchParams(params as unknown as Record<string, string>)
  const res = await fetch(`${STORE_URL}/${path}/?${q}`, { headers })
  return res.json()
}
