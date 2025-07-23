import { join } from 'jsr:@std/path'
import { APP_ENV } from './env.ts'
import { ensureDir as ensureDirAsync } from 'jsr:@std/fs'

const DB_DIR = APP_ENV === 'test' ? './db_test' : './db'

type CollectionOptions<T, K extends keyof T> = {
  name: string
  primaryKey: K
  uniqueKeys?: ReadonlyArray<keyof T>
  cacheSize?: number
}

type Collection<T, K extends keyof T> = {
  readonly name: string
  readonly primaryKey: K
  init(): Promise<void>
  insert(data: Omit<T, K>): Promise<T>
  findById(id: T[K]): Promise<T | null>
  find(predicate: (record: T) => boolean): Promise<T[]>
  update(id: T[K], data: Partial<Omit<T, K>>): Promise<T | null>
  delete(id: T[K]): Promise<boolean>
}

type MetaFile = { nextNumericId: number }

const createMutex = () => {
  let queue = Promise.resolve()
  return {
    async acquire(): Promise<() => void> {
      let release: () => void
      const ticket = new Promise<void>((res) => (release = res))
      const previous = queue
      queue = previous.then(() => ticket)
      await previous
      return release!
    },
  }
}

async function atomicWrite(filePath: string, data: Uint8Array): Promise<void> {
  const tmpPath = `${filePath}.tmp`
  await Deno.writeFile(tmpPath, data)
  await Deno.rename(tmpPath, filePath)
}

function createLru<K, V>(maxSize: number) {
  const map = new Map<K, V>()

  return {
    get(key: K): V | undefined {
      const value = map.get(key)
      if (value !== undefined) {
        map.delete(key)
        map.set(key, value)
      }
      return value
    },
    set(key: K, value: V): void {
      if (map.has(key)) map.delete(key)
      else if (map.size >= maxSize) map.delete(map.keys().next().value!)
      map.set(key, value)
    },
    has(key: K): boolean {
      return map.has(key)
    },
    delete(key: K): boolean {
      return map.delete(key)
    },
    values(): IterableIterator<V> {
      return map.values()
    },
  }
}

const stringifyKey = (v: unknown) => String(v)

export function createCollection<
  T extends Record<PropertyKey, unknown>,
  K extends keyof T,
>(options: CollectionOptions<T, K>): Collection<T, K> {
  const { name, primaryKey, uniqueKeys = [], cacheSize = 1000 } = options

  const collectionDir = join(DB_DIR, name)
  const metaFilePath = join(collectionDir, '_meta.json')
  const mutex = createMutex()
  const lru = createLru<unknown, T>(cacheSize)

  const indexFiles = uniqueKeys.map((key) => ({
    key,
    filePath: join(collectionDir, `_index_unique_${String(key)}.json`),
  }))


  async function readMeta(): Promise<MetaFile> {
    try {
      const text = await Deno.readTextFile(metaFilePath)
      return JSON.parse(text) as MetaFile
    } catch {
      return { nextNumericId: 1 }
    }
  }

  async function writeMeta(meta: MetaFile): Promise<void> {
    const data = new TextEncoder().encode(JSON.stringify(meta, null, 2))
    await atomicWrite(metaFilePath, data)
  }

  async function readIndex(filePath: string): Promise<Record<string, unknown>> {
    try {
      const text = await Deno.readTextFile(filePath)
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  async function writeIndex(
    filePath: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const encoded = new TextEncoder().encode(JSON.stringify(data, null, 2))
    await atomicWrite(filePath, encoded)
  }

  function recordPath(id: unknown): string {
    return join(collectionDir, `${String(id)}.json`)
  }

  async function loadRecord(id: unknown): Promise<T | null> {
    try {
      const text = await Deno.readTextFile(recordPath(id))
      const record = JSON.parse(text) as T
      lru.set(id, record)
      return record
    } catch {
      return null
    }
  }

  async function saveRecord(record: T): Promise<void> {
    const id = record[primaryKey]
    const data = new TextEncoder().encode(JSON.stringify(record, null, 2))
    await atomicWrite(recordPath(id), data)
  }

  async function removeRecord(id: unknown): Promise<void> {
    try {
      await Deno.remove(recordPath(id))
    } catch {
      /* ignore missing file */
    }
  }
  return {
    name,
    primaryKey,

    async init() {
      await ensureDirAsync(collectionDir)
      const release = await mutex.acquire()
      try {
        await readMeta()
      } finally {
        release()
      }
    },

    async insert(data) {
      const release = await mutex.acquire()
      try {
        const meta = await readMeta()
        const id = (typeof meta.nextNumericId === 'number'
          ? meta.nextNumericId
          : crypto.randomUUID()) as T[K]

        const record = { ...data, [primaryKey]: id } as T

        const existingCached = lru.get(id) ?? (await loadRecord(id))
        if (existingCached) {
          throw new Error(
            `Record with ${String(primaryKey)} ${id} already exists`,
          )
        }

        // Validate unique constraints
        for (const { key, filePath } of indexFiles) {
          const value = stringifyKey(record[key])
          const index = await readIndex(filePath)
          if (index[value]) {
            throw new Error(
              `${String(key)} "${value}" already exists`,
            )
          }
          index[value] = id
          await writeIndex(filePath, index)
        }

        await saveRecord(record)
        lru.set(id, record)

        meta.nextNumericId += 1
        await writeMeta(meta)

        return record
      } finally {
        release()
      }
    },

    async findById(id) {
      const cached = lru.get(id)
      if (cached) return cached
      return loadRecord(id)
    },

    async find(predicate) {
      const results: T[] = []

      for (const record of lru.values()) {
        if (predicate(record)) results.push(record)
      }

      for await (const entry of Deno.readDir(collectionDir)) {
        if (
          !entry.isFile || entry.name.startsWith('_') ||
          !entry.name.endsWith('.json')
        ) continue

        const id = Number.isNaN(Number(entry.name.slice(0, -5)))
          ? entry.name.slice(0, -5)
          : Number(entry.name.slice(0, -5))

        if (lru.has(id)) continue
        const record = await loadRecord(id)
        if (record && predicate(record)) results.push(record)
      }
      return results
    },

    async update(id, changes) {
      const release = await mutex.acquire()
      try {
        const record = lru.get(id) ?? (await loadRecord(id))
        if (!record) return null
        for (const { key, filePath } of indexFiles) {
          const newValue = (changes as Partial<T>)[key]
          if (newValue === undefined) continue

          const newStr = stringifyKey(newValue)
          const oldStr = stringifyKey(record[key])
          const index = await readIndex(filePath)

          if (index[newStr] && index[newStr] !== id) {
            throw new Error(
              `${String(key)} "${newStr}" already exists`,
            )
          }
          delete index[oldStr]
          index[newStr] = id
          await writeIndex(filePath, index)
        }
        const updatedRecord = { ...record, ...changes } as T
        await saveRecord(updatedRecord)
        lru.set(id, updatedRecord)
        return updatedRecord
      } finally {
        release()
      }
    },

    async delete(id) {
      const release = await mutex.acquire()
      try {
        const record = lru.get(id) ?? (await loadRecord(id))
        if (!record) return false

        // Remove from all unique indexes
        for (const { key, filePath } of indexFiles) {
          const value = stringifyKey(record[key])
          const index = await readIndex(filePath)
          delete index[value]
          await writeIndex(filePath, index)
        }

        await removeRecord(id)
        lru.delete(id)
        return true
      } finally {
        release()
      }
    },
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Demo                                       */
/* -------------------------------------------------------------------------- */
if (import.meta.main) {
  type User = { id: number; name: string; email: string }

  const users = createCollection<User, 'id'>({
    name: 'users',
    primaryKey: 'id',
    uniqueKeys: ['email'],
    cacheSize: 500,
  })

  await users.init()

  const alice = await users.insert({
    name: 'Alice',
    email: 'alice@example.com',
  })
  console.log('Inserted:', alice)

  const found = await users.findById(alice.id)
  console.log('Found:', found)

  await users.update(alice.id, { email: 'alice@new.dev' })
  console.log('Updated:', await users.findById(alice.id))
  const alice1 = await users.insert({
    name: 'Alice',
    email: 'alice@example.com',
  })
  console.log('Inserted again:', alice1)
  await users.delete(alice.id)
  console.log('Deleted?', !(await users.findById(alice.id)))
}
