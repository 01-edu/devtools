import { STORE_SECRET, STORE_URL } from '/api/lib/env.ts'
import { log } from '/api/lib/logger.ts'

const headers = { authorization: `Bearer ${STORE_SECRET}` }
export const getOne = async <T>(
  path: string,
  id: string,
): Promise<T | null> => {
  const url = `${STORE_URL}/${path}/${encodeURIComponent(String(id))}`
  try {
    const res = await fetch(url, { headers })
    if (res.status === 404) return null
    if (!res.ok) {
      log.error('store-get-one-failed', { path, id, status: res.status })
    }
    return res.json()
  } catch (err) {
    log.error('store-get-one-error', {
      path,
      id,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

export const get = async <T>(
  path: string,
  params?: { q?: string; limit?: number; from?: number },
): Promise<T> => {
  const q = new URLSearchParams(params as unknown as Record<string, string>)
  const url = `${STORE_URL}/${path}/?${q}`
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) {
      log.error('store-get-failed', { path, status: res.status })
    }
    return res.json()
  } catch (err) {
    log.error('store-get-error', {
      path,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
