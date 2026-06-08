import { assert, assertEquals } from '@std/assert'
import { TextLineStream } from '@std/streams/text-line-stream'
import { startRegistryServer } from './local_ipc.ts'

const encoder = new TextEncoder()
const getEndpoint = async () => {
  const endpoint = Deno.build.os === 'windows'
    ? `\\\\.\\pipe\\devtools-test-${crypto.randomUUID()}`
    : `${await Deno.makeTempDir()}/devtools.sock`
  const server = await startRegistryServer(endpoint)
  assert(server)

  async function sendCommand(command: string) {
    const conn = await Deno.connect({ transport: 'unix', path: endpoint })
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
  return {
    sendCommand,
    async [Symbol.asyncDispose]() {
      await server?.close()
      if (Deno.build.os !== 'windows') {
        await Deno.remove(endpoint.slice(0, endpoint.lastIndexOf('/')), {
          recursive: true,
        })
      }
    },
  }
}

Deno.test('local ipc server returns current pid and port', async () => {
  await using endpoint = await getEndpoint()
  const res = await endpoint.sendCommand('info')
  assertEquals(res.pid, Deno.pid)
  assertEquals(typeof res.port, 'number')
})

Deno.test('register returns pid and port on success', async () => {
  await using endpoint = await getEndpoint()
  const res = await endpoint.sendCommand(
    `register/${
      JSON.stringify({
        projectId: 'test-project',
        name: 'Test Project',
        url: 'localhost:9999',
        logsEnabled: true,
        databaseEnabled: false,
      })
    }`,
  )
  assertEquals(res.pid, Deno.pid)
  assertEquals(typeof res.port, 'number')
})

Deno.test('register returns error for invalid payload', async () => {
  await using endpoint = await getEndpoint()
  const res = await endpoint.sendCommand(`register/${JSON.stringify({})}`)
  assertEquals(typeof res.error, 'string')
})
