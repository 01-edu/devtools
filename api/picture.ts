import { crypto } from 'jsr:@std/crypto/crypto'
import { encodeBase64Url } from 'jsr:@std/encoding/base64url'
import { ensureDirSync, exists } from 'jsr:@std/fs'
import { Picture_Dir } from './lib/env.ts'

ensureDirSync(Picture_Dir)

const encoder = new TextEncoder()
export const savePicture = async (url?: string) => {
  if (!url) return
  const bytes = await crypto.subtle.digest('BLAKE3', encoder.encode(url))
  const hash = encodeBase64Url(bytes)
  const file = `${Picture_Dir}/${hash}`
  if (await exists(file)) return hash
  const req = await fetch(url)
  const data = await req.arrayBuffer()
  await Deno.writeFile(file, new Uint8Array(data))
  return hash
}

export const getPicture = async (hash: string) => {
  const picture = await Deno.open(`${Picture_Dir}/${hash}`)
  return new Response(picture.readable, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400, no-transform',
    },
  })
}
