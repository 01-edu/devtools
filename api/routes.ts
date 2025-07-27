import { makeRouter, route } from '/api/lib/router.ts'
import type { RequestContext } from '/api/lib/context.ts'
import { handleGoogleCallback, initiateGoogleAuth } from './auth.ts'

const _withUserSession = ({ session }: RequestContext) => {
  if (!session?.userId) throw Error('Missing user session')
}

const defs = {
  'GET/api/health': route({
    fn: () => new Response('OK'),
    description: 'Health check endpoint',
  }),
   'GET/login': route({
    fn: initiateGoogleAuth,
    description: 'Initiate Google OAuth authentication',
  }),

  'GET/api/auth/google': route({
    fn: handleGoogleCallback,
    description: 'Handle Google OAuth callback',
  }),
} as const

export type RouteDefinitions = typeof defs
export const routeHandler = makeRouter(defs).handle
