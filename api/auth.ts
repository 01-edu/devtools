import { ORIGIN } from '/api/lib/env.ts'
import { fetchJson } from '/api/lib/fetcher.ts'
import {
  decodeGoogleJWT,
  generateStateToken,
  getGoogleAuthUrl,
  GOOGLE_OAUTH_CONFIG,
  verifyState,
} from '/api/lib/google-oauth.ts'
import { respond } from '@01edu/api/response'
import { authenticateOauthUser } from '/api/user.ts'
import { savePicture } from '/api/picture.ts'
import type { RequestContext } from '@01edu/api/context'
import { log } from '/api/lib/logger.ts'

interface GoogleTokens {
  access_token: string
  id_token: string
  expires_in: number
  token_type: string
}

export type GoogleUserInfo = {
  email: string
  name: string
  hd?: string
  sub: string
  picture?: string
  given_name?: string
  family_name?: string
  locale?: string
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 14 // 2 weeks
const GOOGLE_CONFIG = {
  SESSION_MAX_AGE,
  ALLOWED_DOMAIN: '01talent.com',
  COOKIE_OPTIONS: {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax' as const,
    maxAge: SESSION_MAX_AGE,
  },
}

export function initiateGoogleAuth() {
  const { state } = generateStateToken()
  const authUrl = getGoogleAuthUrl(state)
  log.info('oauth-redirect-initiated', { state })
  return new Response(null, {
    status: 302,
    headers: { 'Location': authUrl },
  })
}

export async function handleGoogleCallback(
  ctx: RequestContext,
): Promise<Response> {
  const code = ctx.url.searchParams.get('code')
  const state = ctx.url.searchParams.get('state')

  if (!code) {
    log.warn('oauth-callback-missing-code')
    throw new respond.BadRequestError({
      message: 'Missing authorization code',
      details: 'The authorization code from Google OAuth is required',
    })
  }

  // Verify the state parameter
  if (!verifyState(state || undefined)) {
    log.warn('oauth-callback-invalid-state', { state })
    throw new respond.UnauthorizedError({
      message: 'Invalid state parameter',
      details: 'The state parameter is invalid or has expired',
    })
  }

  // Exchange the code for tokens
  let tokens: GoogleTokens
  try {
    tokens = await fetchJson<GoogleTokens>(
      GOOGLE_OAUTH_CONFIG.tokenEndpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_OAUTH_CONFIG.clientId,
          client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
          redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
          grant_type: 'authorization_code',
        }),
      },
    )
  } catch (err) {
    log.error('oauth-token-exchange-failed', {
      error: err,
    })
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new respond.UnauthorizedError({
      message: `Failed to exchange authorization code: ${message}`,
      error: err,
    })
  }

  // Verify and decode the ID token
  try {
    await fetchJson<unknown>(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${tokens.id_token}`,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new respond.UnauthorizedError({
      message: `Failed to verify Google ID token: ${message}`,
      error: err,
    })
  }

  const userInfo = decodeGoogleJWT(tokens.id_token) as GoogleUserInfo
  userInfo.picture &&= await savePicture(userInfo.picture)
  const sessionId = await authenticateOauthUser(userInfo)

  log.info('oauth-login-success', {
    userId: userInfo.sub,
    email: userInfo.email,
    domain: userInfo.hd,
  })

  // Return response with session cookie
  return new Response(null, {
    status: 302,
    headers: {
      'Location': ORIGIN,
      'Set-Cookie': `session=${sessionId}; ${
        Object.entries(GOOGLE_CONFIG.COOKIE_OPTIONS)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ')
      }`,
    },
  })
}
