import { ORIGIN } from '/api/lib/env.ts'
import {
  decodeGoogleJWT,
  generateStateToken,
  getGoogleAuthUrl,
  GOOGLE_OAUTH_CONFIG,
  verifyGoogleToken,
  verifyState,
} from '/api/lib/google-oauth.ts'
import { respond } from '/api/lib/response.ts'
import { authenticateOauthUser } from '/api/user.ts'
import { savePicture } from '/api/picture.ts'
import type { RequestContext } from '/api/lib/context.ts'

interface GoogleTokens {
  access_token: string
  id_token: string
  expires_in: number
  token_type: string
}

interface GoogleUserInfo {
  email: string
  name: string
  hd?: string
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
    throw new respond.BadRequestError({
      message: 'Missing authorization code',
      details: 'The authorization code from Google OAuth is required',
    })
  }

  // Verify the state parameter
  if (!verifyState(state || undefined)) {
    throw new respond.UnauthorizedError({
      message: 'Invalid state parameter',
      details: 'The state parameter is invalid or has expired',
    })
  }

  // Exchange the code for tokens
  const tokenResponse = await fetch(GOOGLE_OAUTH_CONFIG.tokenEndpoint, {
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
  })

  if (!tokenResponse.ok) {
    throw new respond.UnauthorizedError({
      message: 'Failed to exchange authorization code',
      details: 'Could not obtain access token from Google',
    })
  }

  const tokens = await tokenResponse.json() as GoogleTokens

  // Verify and decode the ID token
  await verifyGoogleToken(tokens.id_token)
  const userInfo = decodeGoogleJWT(tokens.id_token) as GoogleUserInfo
  // Authenticate admin user (creates if doesn't exist)
  const userPicture = await savePicture(userInfo.picture)
  const adminSessionId = await authenticateOauthUser({
    userEmail: userInfo.email,
    userFullName: userInfo.name,
    userPicture,
  })

  // Return response with session cookie
  return new Response(null, {
    status: 302,
    headers: {
      'Location': ORIGIN,
      'Set-Cookie': `session=${adminSessionId}; ${
        Object.entries(GOOGLE_CONFIG.COOKIE_OPTIONS)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ')
      }`,
    },
  })
}
