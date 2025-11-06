// tasks/vite.js
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { build, createServer } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
const isBuild = Deno.args.includes('--build')
const PORT = Number(Deno.env.PORT) || 2119

const denoProxy = () => ({
  name: 'deno-proxy',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url.startsWith('/api/')) return next()
      const hasBody = !(req.method === 'GET' || req.method === 'HEAD')
      const controller = new AbortController()
      res.on('close', () => controller.abort())
      fetch(`http://localhost:${PORT}${req.url}`, {
        method: req.method,
        signal: controller.signal,
        headers: { ...req.headers },
        body: hasBody ? Readable.toWeb(req) : undefined,
        redirect: 'manual',
      })
        .then((apiRes) => {
          const headers = Object.fromEntries(apiRes.headers)
          const cookies = apiRes.headers.getSetCookie()
          if (cookies.length > 0) headers['set-cookie'] = cookies
          res.writeHead(apiRes.status, headers)
          return apiRes.body
            ? pipeline(Readable.fromWeb(apiRes.body), res)
            : res.end()
        })
        .catch((err) => {
          if (controller.signal.aborted) return
          console.error('Error while attempting to proxy', req.method, req.url)
          console.error(err)
          next()
        })
    })
  },
})

if (isBuild) {
  // Production build
  await build({
    configFile: false,
    root: join(import.meta.dirname, '../web'),
    plugins: [
      preact({ jsxImportSource: 'preact' }),
      tailwindcss(),
    ],
    build: {
      outDir: '../dist/web',
      emptyOutDir: true,
    },
  })
} else {
  // Development server
  const server = await createServer({
    configFile: false,
    root: join(import.meta.dirname, '../web'),
    plugins: [
      preact({ jsxImportSource: 'preact' }),
      tailwindcss(),
      denoProxy(),
    ],
    server: {
      port: 7737,
      host: true,
    },
  })
  await server.listen()
  server.printUrls()
  server.bindCLIShortcuts({ print: true })
}
