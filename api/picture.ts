import { crypto } from '@std/crypto/crypto'
import { encodeBase64Url } from '@std/encoding/base64url'
import { ensureDirSync, exists } from '@std/fs'
import { PICTURE_DIR } from '/api/lib/env.ts'

ensureDirSync(PICTURE_DIR)

const encoder = new TextEncoder()
export const savePicture = async (url?: string) => {
  if (!url) return
  const bytes = await crypto.subtle.digest('BLAKE3', encoder.encode(url))
  const hash = encodeBase64Url(bytes)
  const file = `${PICTURE_DIR}/${hash}`
  if (await exists(file)) return hash
  const req = await fetch(url)
  const data = await req.arrayBuffer()
  await Deno.writeFile(file, new Uint8Array(data))
  return hash
}

export const getPicture = async (hash: string) => {
  const picture = await Deno.open(`${PICTURE_DIR}/${hash}`)
  return new Response(picture.readable, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400, no-transform',
    },
  })
}
