import { encodeBase64Url } from '@std/encoding/base64url'
import { crypto } from '@std/crypto'
import { brotliCompress, brotliDecompressSync } from 'node:zlib'
import { promisify } from 'node:util'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const compress = promisify(brotliCompress)
const decompress = (data) => new Uint8Array(brotliDecompressSync(data))

async function transformRowRead(row) {
  if (!row || typeof row !== 'object') return row
  const transformed = { ...row }

  for (const [key, value] of Object.entries(transformed)) {
    if (value instanceof Uint8Array) {
      if (key === 'tacticContent') {
        try {
          transformed[key] = decoder.decode(await decompress(value))
        } catch (e) {
          console.error(`Failed to decompress tacticContent:`, e)
          transformed[key] = encodeBase64Url(value)
        }
      } else {
        transformed[key] = encodeBase64Url(value)
      }
    }
  }
  return transformed
}

async function transformRowWrite(table, data) {
  if (table !== 'tactic' || !data || typeof data !== 'object') return data

  // Only process if tacticContent is a string (new upload)
  if (typeof data.tacticContent === 'string') {
    const bytes = encoder.encode(data.tacticContent)
    const hash = await crypto.subtle.digest('BLAKE3', bytes)
    const compressed = await compress(bytes)

    return {
      ...data,
      tacticHash: encodeBase64Url(hash),
      tacticSize: compressed.byteLength,
      tacticContent: compressed,
    }
  }

  return data
}

export default {
  read: (data, _ctx) => {
    if (Array.isArray(data)) {
      return Promise.all(data.map(transformRowRead))
    }
    return transformRowRead(data)
  },
  write: (table, data) => {
    if (Array.isArray(data)) {
      return Promise.all(data.map((row) => transformRowWrite(table, row)))
    }
    return transformRowWrite(table, data)
  },
  config: {
    targets: ['tactic'],
    events: ['read', 'write'],
  },
}
