export class FetchNetworkError extends Error {
  constructor(
    public url: string,
    public override cause?: unknown,
  ) {
    super(`Network error while fetching ${url}`)
  }
}

export class FetchHttpError extends Error {
  constructor(
    public url: string,
    public status: number,
    public body: string,
  ) {
    super(`HTTP error ${status} while fetching ${url}`)
  }
}

export class FetchJsonError extends Error {
  constructor(
    public url: string,
    public status: number,
    public body: string,
    public override cause?: unknown,
  ) {
    super(`Failed to parse JSON from ${url} (status ${status})`)
  }
}

export class FetchTimeoutError extends Error {
  constructor(
    public url: string,
    public timeoutMs: number,
  ) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`)
  }
}

export function fetchErrorDetails(err: unknown): string {
  if (err instanceof FetchHttpError) {
    return `HTTP ${err.status}: ${err.body}`
  }
  if (err instanceof FetchJsonError) {
    return `Invalid JSON response: ${err.body}`
  }
  if (err instanceof FetchNetworkError) {
    return `Network error: ${err.message}`
  }
  if (err instanceof FetchTimeoutError) {
    return `Request timeout after ${err.timeoutMs}ms`
  }
  return err instanceof Error ? err.message : String(err)
}

export async function fetchJson<T>(
  url: string | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const urlStr = String(url)
  let res: Response

  const controller = new AbortController()
  let timeoutId: number | undefined
  if (init?.timeoutMs) {
    timeoutId = setTimeout(() => controller.abort(), init.timeoutMs)
  }

  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } catch (err) {
    if (
      init?.timeoutMs && err instanceof DOMException && err.name === 'AbortError'
    ) {
      throw new FetchTimeoutError(urlStr, init.timeoutMs)
    }
    throw new FetchNetworkError(urlStr, err)
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }

  const body = await res.text()

  if (!res.ok) {
    throw new FetchHttpError(urlStr, res.status, body)
  }

  try {
    return JSON.parse(body) as T
  } catch (err) {
    throw new FetchJsonError(urlStr, res.status, body, err)
  }
}
