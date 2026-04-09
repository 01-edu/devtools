import { TextLineStream } from '@std/streams/text-line-stream'
import { PORT } from '/api/lib/env.ts'

const encoder = new TextEncoder()
const registrations = new Map<string, number>()

const socket = Deno.build.os === 'windows'
  ? '\\\\.\\pipe\\01-devtools'
  : `${Deno.env.get('XDG_RUNTIME_DIR') || '/tmp'}/01-devtools.sock`

async function removeSocket(path: string) {
  if (Deno.build.os === 'windows') return
  try {
    await Deno.remove(path)
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error
  }
}

async function sendCommand(path: string, command: string) {
  try {
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
  } catch {
    return null
  }
}

async function getAppName(path: string) {
  const { code, stdout } = await new Deno.Command('git', {
    args: ['-C', path, 'config', '--get', 'remote.origin.url'],
    stdout: 'piped',
    stderr: 'null',
  }).output()
  if (code !== 0) return null
  const remote = new TextDecoder().decode(stdout).trim()
  return remote.split(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?$/)[1]
}

export type JSONPrimitive = string | number | boolean | null
export type JSONValue = JSONPrimitive | JSONObject | JSONArray
export type JSONObject = { [member: string]: JSONValue }
export interface JSONArray extends Array<JSONValue> {}
const commands: Record<
  string,
  (arg: string) => Promise<JSONObject> | JSONObject
> = {
  info: () => ({ pid: Deno.pid, port: PORT }),
  register: async (arg: string): Promise<JSONObject> => {
    try {
      const { pid, path } = JSON.parse(arg)
      if (!pid || !path) return { error: 'Usage: register/{"pid":456,"path":"..."}' }
      try {
      const oldPid = registrations.get(path)
        oldPid && Deno.kill(oldPid, 'SIGTERM')    
      } catch {
        // Ignore already-dead processes.
      }
      registrations.set(path, pid)
      const name = (await getAppName(path)) || path.split('/').at(-1)
      return { pid, path, name }
    } catch (err) {
      console.error(err)
      return { error: (err as Error)?.message || String(err) }
    }
  },
  _: () => ({ error: 'Command not found' }),
}

async function handleConn(conn: Deno.Conn) {
  const reader = conn.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())
    .getReader()
  const { value = '' } = await reader.read()
  reader.releaseLock()
  const [name] = value.split('/', 1)
  const arg = value.slice((name?.length || 0) + 1) || ''
  const cmd = commands[name] || commands._
  await conn.write(encoder.encode(JSON.stringify(await cmd(arg)) + '\n'))
  conn.close()
}

async function acceptLoop(listener: Deno.Listener) {
  try {
    for await (const conn of listener) void handleConn(conn)
  } catch (error) {
    if (!(error instanceof Deno.errors.BadResource)) throw error
  }
}

export async function startLocalServer(path = socket) {
  const existing = await sendCommand(path, 'info')
  if (existing) {
    console.info(
      `devtools already started here pid=${existing.pid} port=${existing.port}`,
    )
    Deno.exit(0)
  }

  await removeSocket(path)
  const listener = Deno.listen({ transport: 'unix', path })
  void acceptLoop(listener)
  return {
    close: () => {
      listener.close()
      return removeSocket(path)
    },
  }
}
