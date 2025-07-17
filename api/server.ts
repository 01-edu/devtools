// api/server.ts
// import { serveFile } from "std/http/file_server.ts";

const isProd = Deno.args.includes('--env=prod')
// const staticDir = join(Deno.cwd(), "../web/dist");

export default {
  fetch(req: Request) {
    const url = new URL(req.url)

    // API routes
    if (url.pathname.startsWith('/api')) {
      if (url.pathname === '/api/config') {
        return new Response('hello from api')
      }
      return new Response('Not Found', { status: 404 })
    }

    // Serve static files in production
    if (isProd) {
      const _path = url.pathname === '/' ? '/index.html' : url.pathname
      // try {
      //   const filePath = join(staticDir, path);
      //   return await serveFile(req, filePath);
      // } catch {
      //   // Fallback to index.html for SPA routing
      //   return await serveFile(req, join(staticDir, "index.html"));
      // }
    }

    // In development, redirect to Vite dev server
    return new Response('Use Vite dev server for frontend', { status: 404 })
  },
}
