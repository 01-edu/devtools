// tasks/vite.js
import { join } from 'node:path'
import { build, createServer } from 'vite'
import { apiProxy } from '@01edu/api-proxy'
import deno from '@deno/vite-plugin'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { APP_ENV } from '@01edu/api/env'

const plugins = [
  preact({ jsxImportSource: 'preact' }),
  tailwindcss(),
  deno(),
]

const BASE_URL = Deno.env.get('BASE_URL') || '/'
const preactRuntimeAlias = [
  {
    find: /^npm:preact(?:@[^/]+)?\/jsx-runtime$/,
    replacement: 'preact/jsx-runtime',
  },
  {
    find: /^npm:preact(?:@[^/]+)?\/jsx-dev-runtime$/,
    replacement: 'preact/jsx-dev-runtime',
  },
]

// Production build
if (APP_ENV === 'prod') {
  await build({
    configFile: false,
    root: join(import.meta.dirname!, '../web'),
    plugins,
    base: BASE_URL,
    resolve: { alias: preactRuntimeAlias },
    build: { outDir: '../dist/web', emptyOutDir: true },
  })
  Deno.exit(0)
}

// Development server
const PORT = Number(Deno.env.get('PORT')) || 2119
const server = await createServer({
  configFile: false,
  root: join(import.meta.dirname!, '../web'),
  base: BASE_URL,
  plugins: [...plugins, apiProxy({ port: PORT, prefix: '/api/' })],
  resolve: { alias: preactRuntimeAlias },
  server: { port: 7737, host: true },
})
await server.listen()
server.printUrls()
server.bindCLIShortcuts({ print: true })
