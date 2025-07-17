// tasks/vite.js
import { join } from 'node:path'
import { build, createServer } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import Sonda from 'sonda/vite'

// import { PORT } from '../api/lib/env.ts';
const PORT = 3000

const isBuild = Deno.args.includes('--build')

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
      Sonda({
        enabled: true,
        format: 'html',
      }),
    ],
    server: {
      host: true,
      proxy: { '/api': `http://localhost:${PORT}` },
    },
  })

  await server.listen()
  server.printUrls()
  server.bindCLIShortcuts({ print: true })
}
