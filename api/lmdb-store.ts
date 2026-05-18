import { FetchHttpError, fetchJson } from '/api/lib/fetcher.ts'
import { STORE_SECRET, STORE_URL } from '/api/lib/env.ts'
import { log } from '/api/lib/logger.ts'
import { respond } from '@01edu/api/response'

const headers = { authorization: `Bearer ${STORE_SECRET}` }
export const getOne = async <T>(
  path: string,
  id: string,
): Promise<T | null> => {
  const url = `${STORE_URL}/${path}/${encodeURIComponent(String(id))}`
  try {
    return await fetchJson<T>(url, { headers })
  } catch (err) {
    if (err instanceof FetchHttpError && err.status === 404) {
      return null
    }
    log.error('store-get-one-error', {
      path,
      id,
      error: err,
    })
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new respond.InternalServerErrorError({
      message: `Store request failed: ${message}`,
      error: err,
    })
  }
}

export const get = async <T>(
  path: string,
  params?: { q?: string; limit?: number; from?: number },
): Promise<T> => {
  const q = new URLSearchParams(params as unknown as Record<string, string>)
  try {
    return await fetchJson<T>(`${STORE_URL}/${path}/?${q}`, { headers })
  } catch (err) {
    log.error('store-get-error', {
      path,
      params,
      error: err,
    })
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new respond.InternalServerErrorError({
      message: `Store request failed: ${message}`,
      error: err,
    })
  }
}
