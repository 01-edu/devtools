import { batch } from '/api/lib/json_store.ts'
import { join } from '@std/path'
import { ensureDir } from '@std/fs'
import { DeploymentFunction } from '/api/schema.ts'

// Define the function signatures
export type FunctionContext = {
  deploymentUrl: string
  projectId: string
  variables?: Record<string, unknown>
}

export type ReadTransformer<T = unknown> = (
  row: T,
  ctx: FunctionContext,
) => T | Promise<T>

export type ProjectFunctionModule = {
  read?: ReadTransformer
  config?: {
    targets?: string[]
    events?: string[]
  }
}

export type LoadedFunction = {
  name: string // filename
  module: ProjectFunctionModule
}

// Map<projectSlug, List of loaded functions>
const functionsMap = new Map<string, LoadedFunction[]>()
let watcher: Deno.FsWatcher | null = null
const functionsDir = './db/functions'

export async function init() {
  await ensureDir(functionsDir)
  await loadAll()
  startWatcher()
}

async function loadAll() {
  console.info('Loading project functions...')
  for await (const entry of Deno.readDir(functionsDir)) {
    if (entry.isDirectory) {
      await reloadProjectFunctions(entry.name)
    }
  }
}

async function reloadProjectFunctions(slug: string) {
  const projectDir = join(functionsDir, slug)
  const loaded: LoadedFunction[] = []

  try {
    await batch(5, Deno.readDir(projectDir), async (entry) => {
      if (entry.isFile && entry.name.endsWith('.js')) {
        const mainFile = join(projectDir, entry.name)
        // Build a fresh import URL to bust cache
        const importUrl = `file://${await Deno.realPath(
          mainFile,
        )}?t=${Date.now()}`
        try {
          const module = await import(importUrl)
          // We expect a default export or specific named exports
          const fns = module.default
          if (fns && typeof fns === 'object') {
            loaded.push({ name: entry.name, module: fns })
          }
        } catch (e) {
          console.error(`Failed to import ${entry.name} for ${slug}:`, e)
        }
      }
    })

    // Sort by filename to ensure deterministic execution order
    loaded.sort((a, b) => a.name.localeCompare(b.name))

    if (loaded.length > 0) {
      functionsMap.set(slug, loaded)
      console.info(`Loaded ${loaded.length} functions for project: ${slug}`)
    } else {
      functionsMap.delete(slug)
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      console.error(`Failed to load functions for ${slug}:`, err)
    }
    functionsMap.delete(slug)
  }
}

function startWatcher() {
  if (watcher) return
  console.info(`Starting function watcher on ${functionsDir}`)
  watcher = Deno.watchFs(functionsDir, { recursive: true }) // Process events
  ;(async () => {
    for await (const event of watcher!) {
      if (['modify', 'create', 'remove'].includes(event.kind)) {
        for (const path of event.paths) {
          if (path.endsWith('.js')) {
            const parts = path.split('/')
            const fileName = parts.pop()
            const slug = parts.pop()
            if (fileName && slug) {
              await reloadProjectFunctions(slug)
            }
          }
        }
      }
    }
  })()
}

export function getProjectFunctions(
  slug: string,
): LoadedFunction[] | undefined {
  return functionsMap.get(slug)
}

export function stopWatcher() {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}

export async function applyReadTransformers<T>(
  data: T,
  projectId: string,
  deploymentUrl: string,
  tableName: string,
  projectFunctions?: LoadedFunction[],
  configMap?: Map<string, DeploymentFunction>,
): Promise<T> {
  if (!projectFunctions || projectFunctions.length === 0) {
    return data
  }
  let currentData = data
  for (const { name, module } of projectFunctions) {
    if (!module.read) continue
    const config = configMap?.get(name)
    if (!config) continue
    if (module.config?.targets && !module.config.targets.includes(tableName)) {
      continue
    }
    if (module.config?.events && !module.config.events.includes('read')) {
      continue
    }

    const ctx: FunctionContext = {
      deploymentUrl,
      projectId,
      variables: config.variables || {},
    }

    currentData = await module.read(currentData, ctx) as T
  }

  return currentData
}
