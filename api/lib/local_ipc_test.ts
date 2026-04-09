import { assert, assertEquals } from '@std/assert'
import { TextLineStream } from '@std/streams/text-line-stream'
import { startLocalPingServer } from './local_ipc.ts'
const encoder = new TextEncoder()

async function pingLocalDevtools(path: string) {
  try {
    const conn = await Deno.connect({ transport: 'unix', path })
    await conn.write(encoder.encode('ping\n'))
    const reader = conn.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream())
      .getReader()
    const { value } = await reader.read()
    reader.releaseLock()
    conn.close()
    return value === 'pong'
  } catch {
    return false
  }
}

Deno.test('local ipc ping server replies to ping', async () => {
  const endpoint = Deno.build.os === 'windows'
    ? `\\\\.\\pipe\\devtools-test-${crypto.randomUUID()}`
    : `${await Deno.makeTempDir()}/devtools.sock`

  const server = await startLocalPingServer(endpoint)

  try {
    assert(server)
    assertEquals(await pingLocalDevtools(endpoint), true)
  } finally {
    await server?.close()
    if (Deno.build.os !== 'windows') {
      await Deno.remove(endpoint.slice(0, endpoint.lastIndexOf('/')), {
        recursive: true,
      })
    }
  }
})
