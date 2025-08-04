import { Asserted, makeRouter, route } from '/api/lib/router.ts'
import type { RequestContext } from '/api/lib/context.ts'
import { handleGoogleCallback, initiateGoogleAuth } from './auth.ts'
import { userDef } from './schema.ts'
import { OBJ, STR } from './lib/validator.ts'
import { respond } from './lib/response.ts'
import { deleteCookie } from 'jsr:@std/http/cookie'
import { getPicture } from '/api/picture.ts'
const withUserSession = ({ user }: RequestContext) => {
  if (!user) throw Error('Missing user session')
}

const defs = {
  'GET/api/health': route({
    fn: () => new Response('OK'),
    description: 'Health check endpoint',
  }),
  'GET/api/login': route({
    fn: initiateGoogleAuth,
    description: 'Initiate Google OAuth authentication',
  }),
  'GET/api/auth/google': route({
    fn: handleGoogleCallback,
    description: 'Handle Google OAuth callback',
  }),
  'GET/api/user/me': route({
    authorize: withUserSession,
    fn: ({ user }) => (user as Asserted<typeof userDef>),
    output: userDef,
    description: 'Handle Google OAuth callback',
  }),
  'GET/api/picture': route({
    fn: (_ctx, { hash }) => getPicture(hash),
    input: OBJ({ hash: STR('hash of the picture') }),
  }),
  'GET/api/logout': route({
    fn: (_ctx: RequestContext) => {
      const response = respond.SeeOther(null, { Location: '/' })
      for (const name of ['session', 'trace']) {
        deleteCookie(response.headers, name, {
          path: '/',
          secure: true,
          httpOnly: true,
        })
      }
      return response
    },
    input: OBJ({}),
    output: OBJ({}),
    description: 'Logout the user',
  }),
} as const

export type RouteDefinitions = typeof defs
export const routeHandler = makeRouter(defs).handle
