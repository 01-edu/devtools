import { TextLineStream } from '@std/streams/text-line-stream'
import { PORT } from '/api/lib/env.ts'

const encoder = new TextEncoder()

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

export type JSONPrimitive = string | number | boolean | null
export type JSONValue = JSONPrimitive | JSONObject | JSONArray
export type JSONObject = { [member: string]: JSONValue }
export interface JSONArray extends Array<JSONValue> {}
const commands: Record<string, () => Promise<JSONValue> | JSONValue> = {
  info: () => ({ pid: Deno.pid, port: PORT }),
  _: () => ({ error: 'Command not found' }),
}

async function handleConn(conn: Deno.Conn) {
  const reader = conn.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())
    .getReader()
  const { value } = await reader.read()
  reader.releaseLock()
  const cmd = commands[value as keyof typeof commands] || commands._
  await conn.write(encoder.encode(JSON.stringify(await cmd()) + '\n'))
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
