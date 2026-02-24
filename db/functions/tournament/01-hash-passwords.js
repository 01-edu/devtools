import { crypto } from '@std/crypto'

const SALT_LEN = 8
const encoder = new TextEncoder()

const withSalt = (salt, values) => {
  const salted = new Uint8Array(values.byteLength + SALT_LEN)
  salted.set(salt)
  salted.set(values, SALT_LEN)
  return salted
}

const hashText = async (
  text,
  salt = crypto.getRandomValues(new Uint8Array(SALT_LEN)),
) => {
  const bytes = encoder.encode(text)
  const hash = await crypto.subtle.digest('BLAKE3', withSalt(salt, bytes))
  return withSalt(salt, new Uint8Array(hash))
}

export default {
  write: async (table, data, _query, _ctx) => {
    if (table !== 'users') return data
    if (!data || typeof data !== 'object' || !data.password) return data
    const password = await hashText(data.password)
    return { ...data, password }
  },
  config: {
    targets: ['users'],
    events: ['write'],
  },
}
