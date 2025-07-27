import { CLIENT_SECRET, GOOGLE_CLIENT_ID, REDIRECT_URI } from './env.ts'
export const GOOGLE_OAUTH_CONFIG = {
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  redirectUri: REDIRECT_URI,
  scope: 'openid email profile',
}

class StateManager {
  private store = new Map<string, { expires: number }>()
  private cleanupInterval: number

  constructor(private maxAge = 10 * 60 * 1000) { // 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  generate(): string {
    const state = crypto.randomUUID()
    this.store.set(state, {
      expires: Date.now() + this.maxAge,
    })
    return state
  }

  verify(state: string): boolean {
    const data = this.store.get(state)
    if (!data) return false

    this.store.delete(state)
    return data.expires > Date.now()
  }

  private cleanup() {
    const now = Date.now()
    for (const [state, data] of this.store.entries()) {
      if (data.expires < now) {
        this.store.delete(state)
      }
    }
  }

  dispose() {
    clearInterval(this.cleanupInterval)
    this.store.clear()
  }
}

const stateManager = new StateManager()

export function generateStateToken(): { state: string; stateId: string } {
  const state = stateManager.generate()
  return { state, stateId: state }
}

export function verifyState(receivedState: string | undefined): boolean {
  if (!receivedState) return false
  return stateManager.verify(receivedState)
}

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CONFIG.clientId,
    redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_CONFIG.scope,
    state,
    access_type: 'offline',
    prompt: 'consent',
  })

  return `${GOOGLE_OAUTH_CONFIG.authEndpoint}?${params.toString()}`
}

export async function verifyGoogleToken(idToken: string) {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
  )
  if (!response.ok) {
    throw new Error('Invalid token')
  }
  return response.json()
}

export function decodeGoogleJWT(idToken: string) {
  const [, payload] = idToken.split('.')
  if (!payload) throw new Error('Invalid ID token format')
  try {
    return JSON.parse(atob(payload)) as {
      email: string
      name: string
      hd?: string
    }
  } catch {
    throw new Error('Invalid ID token payload')
  }
}