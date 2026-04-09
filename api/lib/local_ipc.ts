import { TextLineStream } from '@std/streams/text-line-stream'

const encoder = new TextEncoder()

export const getLocalDevtoolsEndpoint = () =>
  Deno.build.os === 'windows'
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

async function handleConn(conn: Deno.Conn) {
  const reader = conn.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())
    .getReader()
  const { value } = await reader.read()
  reader.releaseLock()
  if (value === 'ping') await conn.write(encoder.encode('pong\n'))
  conn.close()
}

async function acceptLoop(listener: Deno.Listener) {
  try {
    for await (const conn of listener) void handleConn(conn)
  } catch (error) {
    if (!(error instanceof Deno.errors.BadResource)) throw error
  }
}

export async function startLocalPingServer(path = getLocalDevtoolsEndpoint()) {
  await removeSocket(path)
  const listener = Deno.listen({ transport: 'unix', path })
  void acceptLoop(listener)
  const close = () => {
    listener.close()
    return removeSocket(path)
  }
  return { close }
}
