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

export async function fetchJson<T>(
  url: string | URL,
  init?: RequestInit,
): Promise<T> {
  const urlStr = String(url)
  let res: Response

  try {
    res = await fetch(url, init)
  } catch (err) {
    throw new FetchNetworkError(urlStr, err)
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
