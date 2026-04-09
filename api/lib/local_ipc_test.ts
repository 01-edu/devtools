import { assert, assertEquals } from '@std/assert'
import { TextLineStream } from '@std/streams/text-line-stream'
import { startLocalServer } from './local_ipc.ts'

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
    ? `\\\\.\\pipe\\devtools-test-${crypto.randomUUID()}`
    : `${await Deno.makeTempDir()}/devtools.sock`

  const server = await startLocalServer(endpoint)

  try {
    assert(server)
    assertEquals(await sendCommand(endpoint, 'info'), {
      pid: Deno.pid,
      port: 3021,
    })
  } finally {
    await server?.close()
    if (Deno.build.os !== 'windows') {
      await Deno.remove(endpoint.slice(0, endpoint.lastIndexOf('/')), {
        recursive: true,
      })
    }
  }
})

Deno.test('register stores app info from github remote', async () => {
  const endpoint = Deno.build.os === 'windows'
    ? `\\\\.\\pipe\\devtools-test-${crypto.randomUUID()}`
    : `${await Deno.makeTempDir()}/devtools.sock`
  const repo = await Deno.makeTempDir()

  const server = await startLocalServer(endpoint)

  try {
    assert(server)
    await new Deno.Command('git', {
      args: ['-C', repo, 'init'],
      stdout: 'null',
      stderr: 'null',
    }).output()
    await new Deno.Command('git', {
      args: ['-C', repo, 'remote', 'add', 'origin', 'git@github.com:org/repo.git'],
      stdout: 'null',
      stderr: 'null',
    }).output()

    assertEquals(
      await sendCommand(endpoint, `register/${JSON.stringify({ pid: 123, path: repo})}`),
      { pid: 123, path: repo, name: 'org/repo' },
    )
  } finally {
    await server?.close()
    if (Deno.build.os !== 'windows') {
      await Deno.remove(endpoint.slice(0, endpoint.lastIndexOf('/')), {
        recursive: true,
      })
    }
    await Deno.remove(repo, { recursive: true })
  }
})
