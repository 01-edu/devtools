import { assert, assertEquals } from '@std/assert'
import { TextLineStream } from '@std/streams/text-line-stream'
import { startRegistryServer } from './local_ipc.ts'

const encoder = new TextEncoder()

async function sendCommand(path: string, command: string) {
  const conn = await Deno.connect({ transport: 'unix', path })
  await conn.write(encoder.encode(`${command}\n`))
  const reader = conn.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())
    .getReader()
  const { value } = await reader.read()
  reader.releaseLock()
  conn.close()
  return JSON.parse(value!)
}

Deno.test('local ipc server returns current pid and port', async () => {
  const endpoint = Deno.build.os === 'windows'
    ? `\\.\pipe\devtools-test-${crypto.randomUUID()}`
    : `${await Deno.makeTempDir()}/devtools.sock`

  const server = await startRegistryServer(endpoint)

  try {
    assert(server)
    const res = await sendCommand(endpoint, 'info')
    assertEquals(res.pid, Deno.pid)
    assertEquals(typeof res.port, 'number')
  } finally {
    await server?.close()
    if (Deno.build.os !== 'windows') {
      await Deno.remove(endpoint.slice(0, endpoint.lastIndexOf('/')), {
        recursive: true,
      })
    }
  }
})

Deno.test('register returns pid and port on success', async () => {
  const endpoint = Deno.build.os === 'windows'
    ? `\\.\pipe\devtools-test-${crypto.randomUUID()}`
    : `${await Deno.makeTempDir()}/devtools.sock`

  const server = await startRegistryServer(endpoint)

  try {
    assert(server)
    const res = await sendCommand(
      endpoint,
      `register/${JSON.stringify({
        projectId: 'test-project',
        name: 'Test Project',
        url: 'localhost:9999',
        logsEnabled: true,
        databaseEnabled: false,
      })}`,
    )
    assertEquals(res.pid, Deno.pid)
    assertEquals(typeof res.port, 'number')
  } finally {
    await server?.close()
    if (Deno.build.os !== 'windows') {
      await Deno.remove(endpoint.slice(0, endpoint.lastIndexOf('/')), {
        recursive: true,
      })
    }
  }
})

Deno.test('register returns error for invalid payload', async () => {
  const endpoint = Deno.build.os === 'windows'
    ? `\\.\pipe\devtools-test-${crypto.randomUUID()}`
    : `${await Deno.makeTempDir()}/devtools.sock`

  const server = await startRegistryServer(endpoint)

  try {
    assert(server)
    const res = await sendCommand(
      endpoint,
      `register/${JSON.stringify({})}`,
    )
    assertEquals(typeof res.error, 'string')
  } finally {
    await server?.close()
    if (Deno.build.os !== 'windows') {
      await Deno.remove(endpoint.slice(0, endpoint.lastIndexOf('/')), {
        recursive: true,
      })
    }
  }
})
