import { crypto } from '@std/crypto/crypto'
import { encodeBase64Url } from '@std/encoding/base64url'
import { ensureDirSync, exists } from '@std/fs'
import { PICTURE_DIR } from '/api/lib/env.ts'
import { log } from '/api/lib/logger.ts'

ensureDirSync(PICTURE_DIR)

const encoder = new TextEncoder()
export const savePicture = async (url?: string) => {
  if (!url) return
  const bytes = await crypto.subtle.digest('BLAKE3', encoder.encode(url))
  const hash = encodeBase64Url(bytes)
  const file = `${PICTURE_DIR}/${hash}`
  if (await exists(file)) return hash
  try {
    const req = await fetch(url)
    if (!req.ok) {
      log.warn('picture-fetch-failed', { url, status: req.status })
      return
    }
    const data = await req.arrayBuffer()
    await Deno.writeFile(file, new Uint8Array(data))
    return hash
  } catch (err) {
    log.error('picture-save-failed', {
      url,
      error: err instanceof Error ? err.message : String(err),
    })
    return undefined
  }
}

export const getPicture = async (hash: string) => {
  try {
    const picture = await Deno.open(`${PICTURE_DIR}/${hash}`)
    return new Response(picture.readable, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=86400, no-transform',
      },
    })
  } catch (err) {
    log.error('picture-read-failed', {
      hash,
      error: err instanceof Error ? err.message : String(err),
    })
    return new Response('Picture not found', { status: 404 })
  }
}
