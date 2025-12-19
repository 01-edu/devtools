import { serveDir } from '@std/http/file-server'
import { APP_ENV } from '@01edu/api/env'
import { server } from '@01edu/api/server'
import { log } from '/api/lib/log.ts'
import { routeHandler } from '/api/routes.ts'

const fetch = server({ log, routeHandler })
export default {
  fetch(req: Request) {
    return fetch(req, new URL(req.url))
  },
}

if (APP_ENV === 'prod') {
  const indexHtml = await Deno.readFile(
    import.meta.dirname + '/web/dist/index.html',
  )
  const htmlContent = { headers: { 'Content-Type': 'text/html' } }
  const serveDirOpts = { fsRoot: import.meta.dirname + '/web/dist' }
  Deno.serve((req) => {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/')) return fetch(req, url)
    if (url.pathname.includes('.')) return serveDir(req, serveDirOpts)
    return new Response(indexHtml, htmlContent)
  })
} else {
  log.info('server-start')
}
