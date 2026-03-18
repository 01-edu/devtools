import { STORE_SECRET, STORE_URL } from '/api/lib/env.ts'

const headers = { authorization: `Bearer ${STORE_SECRET}` }
export const getOne = async <T>(
  path: string,
  id: string,
): Promise<T | null> => {
  const url = `${STORE_URL}/${path}/${encodeURIComponent(String(id))}`
  const res = await fetch(url, { headers })
  if (res.status === 404) return null
  return res.json()
}

export const get = async <T>(
  path: string,
  params?: { q?: string; limit?: number; from?: number },
): Promise<T> => {
  const q = new URLSearchParams(params as unknown as Record<string, string>)
  const res = await fetch(`${STORE_URL}/${path}/?${q}`, { headers })
  return res.json()
}
