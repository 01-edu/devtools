import { TextLineStream } from '@std/streams/text-line-stream'
import { PORT } from '/api/lib/env.ts'
import { DeploymentsCollection, ProjectsCollection } from '/api/schema.ts'

const defaultSocketPath = Deno.build.os === 'windows'
  ? '\\\\.\\pipe\\01-devtools'
  : `${Deno.env.get('XDG_RUNTIME_DIR') || '/tmp'}/01-devtools.sock`

const encoder = new TextEncoder()

async function removeSocket(path: string) {
  if (Deno.build.os === 'windows') return
  try {
    await Deno.remove(path)
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error
  }
}

async function sendCommand(socketPath: string, command: string) {
  try {
    const conn = await Deno.connect({ transport: 'unix', path: socketPath })
    await conn.write(encoder.encode(`${command}\n`))
    const reader = conn.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream())
      .getReader()
    const { value } = await reader.read()
    reader.releaseLock()
    conn.close()
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

type JSONPrimitive = string | number | boolean | null
type JSONValue = JSONPrimitive | JSONObject | JSONArray
interface JSONObject {
  [member: string]: JSONValue
}
interface JSONArray extends Array<JSONValue> {}

const commands: Record<
  string,
  (arg: string) => Promise<JSONObject> | JSONObject
> = {
  info: () => ({ pid: Deno.pid, port: PORT }),

  register: async (arg: string): Promise<JSONObject> => {
    try {
      const {
        projectId,
        name,
        url,
        logsEnabled,
        databaseEnabled,
        sqlEndpoint,
        sqlToken,
      } = JSON.parse(arg)

      if (!projectId || !url) {
        return {
          error: 'Usage: register/{"projectId":"...","url":"..."...}',
        }
      }

      // Create or update project
      const projectName = name || projectId
      const existingProject = ProjectsCollection.get(projectId)
      if (!existingProject) {
        await ProjectsCollection.insert({
          slug: projectId,
          name: projectName,
          teamId: 'local',
          isPublic: true,
          repositoryUrl: null,
        })
      }

      // Create or update deployment
      const existingDeployment = DeploymentsCollection.get(url)
      if (existingDeployment) {
        await DeploymentsCollection.update(url, {
          projectId,
          logsEnabled: logsEnabled ?? true,
          databaseEnabled: databaseEnabled ?? false,
          sqlEndpoint: sqlEndpoint || undefined,
          sqlToken: sqlToken || 'local',
          tokenSalt: crypto.randomUUID(),
        })
      } else {
        await DeploymentsCollection.insert({
          projectId,
          url,
          logsEnabled: logsEnabled ?? true,
          databaseEnabled: databaseEnabled ?? false,
          sqlEndpoint: sqlEndpoint || undefined,
          sqlToken: sqlToken || 'local',
          tokenSalt: crypto.randomUUID(),
        })
      }

      return { pid: Deno.pid, port: PORT }
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

export async function startRegistryServer(socketPath = defaultSocketPath) {
  const existing = await sendCommand(socketPath, 'info')
  if (existing) {
    console.info(
      `devtools already started here pid=${existing.pid} port=${existing.port}`,
    )
    Deno.exit(0)
  }

  await removeSocket(socketPath)
  const listener = Deno.listen({ transport: 'unix', path: socketPath })
  void acceptLoop(listener)
  return {
    close: () => {
      listener.close()
      return removeSocket(socketPath)
    },
  }
}
