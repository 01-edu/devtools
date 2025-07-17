import { makeRouter, route } from '/api/lib/router.ts'
import type { RequestContext } from '/api/lib/context.ts'

const _withUserSession = ({ session }: RequestContext) => {
  if (!session?.userId) throw Error('Missing user session')
}

const defs = {
  'GET/api/health': route({
    fn: () => new Response('OK'),
    description: 'Health check endpoint',
  }),
} as const

export type RouteDefinitions = typeof defs
export const routeHandler = makeRouter(defs).handle
