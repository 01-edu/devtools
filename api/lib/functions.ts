import { batch } from '/api/lib/json_store.ts'
import { join, toFileUrl } from '@std/path'
import { ensureDir } from '@std/fs'
import { log } from '/api/lib/logger.ts'

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
const functionsDir = join(import.meta.dirname!, '../../db/functions')
const functionsDirUrl = toFileUrl(
  functionsDir.endsWith('/') ? functionsDir : `${functionsDir}/`,
)

export async function init() {
  await ensureDir(functionsDir)
  await loadAll()
}

async function loadAll() {
  log.info('loading-project-functions')
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
          log.error('failed-to-import-function', {
            file: entry.name,
            project: slug,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }
    })

    // Sort by filename to ensure deterministic execution order
    loaded.sort((a, b) => a.name.localeCompare(b.name))

    if (loaded.length > 0) {
      functionsMap.set(slug, loaded)
      log.info('loaded-project-functions', {
        count: loaded.length,
        project: slug,
      })
    } else {
      functionsMap.delete(slug)
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      log.error('failed-to-load-functions', {
        project: slug,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    functionsMap.delete(slug)
  }
}

export function getProjectFunctions(
  slug: string,
): LoadedFunction[] | undefined {
  return functionsMap.get(slug)
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
