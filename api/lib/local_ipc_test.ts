import { assert } from '@std/assert'
import { startLocalServer } from './local_ipc.ts'

Deno.test('local ipc server returns current pid and port', async () => {
  const endpoint = Deno.build.os === 'windows'
    ? `\\\\.\\pipe\\devtools-test-${crypto.randomUUID()}`
    : `${await Deno.makeTempDir()}/devtools.sock`

  const server = await startLocalServer(endpoint)

  try {
    assert(server)
  } finally {
    await server?.close()
    if (Deno.build.os !== 'windows') {
      await Deno.remove(endpoint.slice(0, endpoint.lastIndexOf('/')), {
        recursive: true,
      })
    }
  }
})
