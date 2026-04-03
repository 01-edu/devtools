import { batch } from '/api/lib/json_store.ts'
import { join, toFileUrl } from '@std/path'
import { ensureDir } from '@std/fs'

// Define the function signatures
export type FunctionContext = {
  deploymentUrl: string
  projectId: string
}

export type ReadTransformer<T = unknown> = (
  data: T,
  ctx: FunctionContext,
) => T | Promise<T>

export type WriteTransformer<T = unknown> = (
  table: string,
  data: T,
  query: string | undefined,
  ctx: FunctionContext,
) => T | Promise<T>

export type ProjectFunctionModule = {
  read?: ReadTransformer
  write?: WriteTransformer
  config?: {
    targets?: string[]
  }
}

export type LoadedFunction = {
  name: string // filename
  module: ProjectFunctionModule
}

// Map<projectSlug, List of loaded functions>
const functionsMap = new Map<string, LoadedFunction[]>()
let watcher: Deno.FsWatcher | null = null
const functionsDir = join(import.meta.dirname!, '../../db/functions')
const functionsDirUrl = toFileUrl(
  functionsDir.endsWith('/') ? functionsDir : `${functionsDir}/`,
)

export async function init() {
  await ensureDir(functionsDir)
  await loadAll()
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
  const projectDirUrl = new URL(`${slug}/`, functionsDirUrl)
  const loaded: LoadedFunction[] = []

  try {
    await batch(5, Deno.readDir(projectDir), async (entry) => {
      if (entry.isFile && entry.name.endsWith('.js')) {
        const mainFileUrl = new URL(entry.name, projectDirUrl)
        try {
          const module = await import(`${mainFileUrl.href}?t=${Date.now()}`)
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
): Promise<T> {
  if (!projectFunctions || projectFunctions.length === 0) {
    return data
  }
  let currentData = data
  for (const { module } of projectFunctions) {
    if (!module.read) continue
    if (module.config?.targets && !module.config.targets.includes(tableName)) {
      continue
    }

    const ctx: FunctionContext = {
      deploymentUrl,
      projectId,
    }

    currentData = await module.read(currentData, ctx) as T
  }

  return currentData
}

export async function applyWriteTransformers<T>(
  data: T,
  projectId: string,
  deploymentUrl: string,
  tableName: string,
  projectFunctions?: LoadedFunction[],
): Promise<T> {
  if (!projectFunctions || projectFunctions.length === 0) {
    return data
  }
  let currentData = data
  for (const { module } of projectFunctions) {
    if (!module.write) continue
    if (module.config?.targets && !module.config.targets.includes(tableName)) {
      continue
    }

    const ctx: FunctionContext = {
      deploymentUrl,
      projectId,
    }

    currentData = await module.write(
      tableName,
      currentData,
      undefined,
      ctx,
    ) as T
  }

  return currentData
}
