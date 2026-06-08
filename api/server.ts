import { serveDir } from '@std/http/file-server'
import { server } from '@01edu/api/server'
import { routeHandler } from '/api/routes.ts'
import { APP_ENV, isLocal, PORT } from '/api/lib/env.ts'
import { init } from '/api/lib/functions.ts'
import { initLogTable } from '/api/clickhouse-client.ts'
import { startRegistryServer } from '/api/lib/local_ipc.ts'
import { startSchemaRefreshLoop } from '/api/sql.ts'
import { log } from '/api/lib/logger.ts'

await initLogTable()
await init()
startSchemaRefreshLoop()
isLocal && (await startRegistryServer())

const fetch = server({ log, routeHandler })
export default {
  fetch: (req: Request) => fetch(req, new URL(req.url)),
}

if (APP_ENV === 'prod') {
  const indexHtml = await Deno.readFile(
    new URL('../dist/web/index.html', import.meta.url),
  )
  const htmlContent = { headers: { 'Content-Type': 'text/html' } }
  const serveDirOpts = {
    fsRoot: new URL('../dist/web', import.meta.url).pathname,
  }
  Deno.serve({ port: PORT }, (req) => {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/')) return fetch(req, url)
    if (url.pathname.includes('.')) return serveDir(req, serveDirOpts)
    return new Response(indexHtml, htmlContent)
  })
} else {
  log.info('server-start')
}
