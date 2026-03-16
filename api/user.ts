import { decodeBase64Url, encodeBase64Url } from '@std/encoding/base64url'
import { SECRET } from '/api/lib/env.ts'
import { getOne } from './lmdb-store.ts'
import { GoogleUserInfo } from './auth.ts'
// import { UsersCollection } from '/api/schema.ts'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const IV_SIZE = 12 // Initialization vector (12 bytes for AES-GCM)

export async function encryptMessage(message: string) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE))
  const encryptedMessage = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(message),
  )

  const result = new Uint8Array(encryptedMessage.byteLength + iv.byteLength)
  result.set(iv)
  result.set(new Uint8Array(encryptedMessage), iv.byteLength)
  return encodeBase64Url(result)
}

// Decrypting a message
export async function decryptMessage(encryptedMessage: string) {
  const encryptedData = decodeBase64Url(encryptedMessage)
  const iv = encryptedData.slice(0, IV_SIZE)
  const decryptedMessage = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData.slice(IV_SIZE),
  )

  return decoder.decode(decryptedMessage)
}

const key = await crypto.subtle.importKey(
  'raw',
  decodeBase64Url(SECRET) as ArrayBufferView<ArrayBuffer>,
  { name: 'AES-GCM' },
  true, // The key should be extractable
  ['encrypt', 'decrypt'],
)

export async function decodeSession(sessionCode?: string) {
  if (sessionCode == null) return
  try {
    const json = await decryptMessage(sessionCode)
    const googleUser = JSON.parse(json) as GoogleUserInfo
    const user = await getOne<
      { name: { fullName: string }; thumbnailPhotoUrl: string }
    >(
      'google/user',
      googleUser.sub,
    )
    if (!user) throw Error('User not found')
    return {
      id: googleUser.sub,
      email: googleUser.email,
      fullName: user.name.fullName,
      picture: user.thumbnailPhotoUrl,
    }
  } catch {
    // Invalid session code
  }
}

export function authenticateOauthUser(
  oauthInfo: GoogleUserInfo,
) {
  const json = JSON.stringify(oauthInfo)
  return encryptMessage(json)
}
