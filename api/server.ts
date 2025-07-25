// api/server.ts
import { decodeSession } from '/api/user.ts'
import { respond } from '/api/lib/response.ts'
import { now } from '/api/lib/time.ts'
import { log } from '/api/lib/log.ts'
import { routeHandler } from '/api/routes.ts'
import { getCookies, setCookie } from 'jsr:@std/http/cookie'
import { type RequestContext, requestContext } from '/api/lib/context.ts'
import { join } from 'jsr:@std/path/join'
import { serveDir } from 'jsr:@std/http/file-server'
import { PORT } from './lib/env.ts'

const staticDir = join(Deno.cwd(), 'dist/web')
const indexHtml = await Deno.readFile(join(staticDir, 'index.html'))
const htmlContent = { headers: { 'Content-Type': 'text/html' } }
const serveDirOpts = { fsRoot: staticDir }

const { ResponseError } = respond
const isProd = Deno.args.includes('--env=prod')

const handleRequest = async (ctx: RequestContext) => {
  const logProps: Record<string, unknown> = {}
  logProps.path = `${ctx.req.method}:${ctx.url.pathname.slice('/api/'.length)}`
  log.info('in', logProps)
  try {
    const res = await routeHandler(ctx)
    logProps.status = res.status
    logProps.duration = now() - ctx.span!
    log.info('out', logProps)
    return res
  } catch (err) {
    let response: Response
    if (err instanceof ResponseError) {
      response = err.response
      logProps.status = response.status
    } else {
      logProps.status = 500
      logProps.stack = err
      response = respond.InternalServerError()
    }

    logProps.duration = now() - ctx.span!
    log.error('out', logProps)
    return response
  }
}

export const fetch = async (req: Request) => {
  const url = new URL(req.url)
  const method = req.method
  if (method === 'OPTIONS') return respond.NoContent()

  if (url.pathname.startsWith('/api')) {
    // Build the request context
    const cookies = getCookies(req.headers)
    const ctx = {
      req,
      url,
      cookies,
      trace: cookies.trace ? Number(cookies.trace) : now(),
      session: decodeSession(cookies.session),
      span: now(),
    }

    const res = await requestContext.run(ctx, handleRequest, ctx)
    if (!cookies.trace) {
      // if the cookies do not yet have a trace, we set it for the future
      setCookie(res.headers, {
        name: 'trace',
        value: String(ctx.trace),
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      })
    }
    return res
  }

  // Serve static files in production
  if (isProd) {
    if (url.pathname.includes('.')) {
      return serveDir(req, serveDirOpts)
    }

    return new Response(indexHtml, htmlContent)
  }

  // In development, redirect to Vite dev server
  return new Response('Use Vite dev server for frontend', { status: 404 })
}

log.info('server-start')

Deno.serve({
  port: PORT,
}, fetch)
