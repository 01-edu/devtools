import { SECRET } from './lib/env.ts'
import { UsersCollection } from './schema.ts'

import { decodeBase64Url, encodeBase64Url } from 'jsr:@std/encoding/base64url'

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
    const id = await decryptMessage(sessionCode)
    return UsersCollection.find(({ userEmail }) => userEmail === id)
  } catch {
    // Invalid session code
  }
}

export async function authenticateOauthUser(
  oauthInfo: {
    userEmail: string
    userFullName: string
    userPicture: string | undefined
  },
) {
  const existingUser = UsersCollection.find(({ userEmail }) =>
    userEmail === oauthInfo.userEmail.trim()
  )

  let userEmail: string
  if (!existingUser) {
    const newUser = await UsersCollection.insert({
      ...oauthInfo,
      isAdmin: false,
    })
    userEmail = newUser.userEmail
  } else {
    userEmail = existingUser.userEmail
    const needsUpdate = existingUser.userFullName !== oauthInfo.userFullName ||
      existingUser.userPicture !== oauthInfo.userPicture
    needsUpdate && UsersCollection.update(existingUser.userEmail, {
      userFullName: oauthInfo.userFullName,
      userPicture: oauthInfo.userPicture,
    })
  }
  // Encrypt
  return encryptMessage(userEmail)
}
