// tasks/vite.js
import { join } from 'node:path'
import { AliasOptions, build, createServer } from 'vite'
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

const alias: AliasOptions = [
  {
    find: 'npm:@preact/signals@^2.5.1',
    replacement: '@preact/signals',
  },
  {
    find: 'npm:preact@^10.27.2',
    replacement: 'preact',
  },
]
// Production build
if (APP_ENV === 'prod') {
  await build({
    configFile: false,
    root: join(import.meta.dirname!, '../web'),
    plugins,
    resolve: { alias },
    build: {
      outDir: '../dist/web',
      emptyOutDir: true,
    },
  })
  Deno.exit(0)
}

// Development server
const PORT = Number(Deno.env.get('PORT')) || 2119
const server = await createServer({
  configFile: false,
  root: join(import.meta.dirname!, '../web'),
  plugins: [...plugins, apiProxy({ port: PORT, prefix: '/api/' })],
  resolve: { alias },
  server: {
    port: 7737,
    host: true,
  },
})
await server.listen()
server.printUrls()
server.bindCLIShortcuts({ print: true })
