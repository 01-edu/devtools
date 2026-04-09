import { serveDir } from '@std/http/file-server'
import { server } from '@01edu/api/server'
import { Log } from '@01edu/api/log'
import { routeHandler } from '/api/routes.ts'
import { PORT, APP_ENV, isLocal } from '/api/lib/env.ts'
import { init } from '/api/lib/functions.ts'
import { initLogTable } from '/api/clickhouse-client.ts'
import { startLocalPingServer } from '/api/lib/local_ipc.ts'
import { startSchemaRefreshLoop } from '/api/sql.ts'

await initLogTable()
await init()
startSchemaRefreshLoop()
isLocal && (await startLocalPingServer())

const fetch = server({ log: console as unknown as Log, routeHandler })
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
  console.info('server-start')
}
