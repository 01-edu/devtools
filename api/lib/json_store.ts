// zero-db.ts
import { join } from 'jsr:@std/path'
import { APP_ENV } from './env.ts'
import { ensureDir } from 'jsr:@std/fs'

const DB_DIR = APP_ENV === 'test' ? './db_test' : './db'

type CollectionOptions<T, K extends keyof T> = {
  name: string
  primaryKey: K extends string ? K : never
}
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = `${filePath}.tmp`
  await Deno.writeTextFile(tmp, content)
  await Deno.rename(tmp, filePath)
}

const batch = async <T>(
  concurrency: number,
  source: AsyncIterable<T>,
  handler: (item: T) => Promise<unknown>,
) => {
  const pool: (number | Promise<number>)[] = Array(concurrency).keys().toArray()
  const handlers = pool.map((i) => async (item: T) => {
    await handler(item)
    return i
  })
  for await (const item of source) {
    const next = await Promise.race(pool)
    pool[next] = handlers[next](item)
  }
  await Promise.all(pool)
}

export type BaseRecord = { createdAt: number; updatedAt: number }

export async function createCollection<
  T extends Record<PropertyKey, unknown>,
  K extends keyof T,
>({ name, primaryKey }: CollectionOptions<T, K>) {
  const dir = join(DB_DIR, name)
  await ensureDir(dir)
  const records = new Map<T[K], T>()
  const recordFile = (id: T[K]) => join(dir, `${id}.json`)
  await batch(10, Deno.readDir(dir), async (entry) => {
    if (!entry.isFile || !entry.name.endsWith('.json')) return
    const id = entry.name.slice(0, -5) as T[K]
    try {
      const rec = JSON.parse(await Deno.readTextFile(recordFile(id))) as T
      records.set(id, rec)
    } catch {
      // corrupted file, ignore
    }
  })

  async function saveRecord(rec: T) {
    const id = rec[primaryKey]
    await atomicWrite(recordFile(id), JSON.stringify(rec, null, 2))
  }

  return {
    name,
    primaryKey,

    async insert(data: T) {
      const id = data[primaryKey]
      if (!id) throw Error(`Missing primary key ${primaryKey}`)
      if (records.has(id)) throw Error(`${id} already exists`)
      Object.assign(data, { createdAt: Date.now(), updatedAt: Date.now() })
      records.set(id, data)
      await saveRecord(data)

      return data as T & BaseRecord
    },

    [Symbol.iterator]: () => records[Symbol.iterator],
    keys: () => records.keys(),
    values: () => records.values() as MapIterator<T & BaseRecord>,
    entries: () => records.entries() as MapIterator<[T[K], T & BaseRecord]>,
    get: (id: T[K]) => records.get(id) as T & BaseRecord | undefined,
    assert: (id: T[K]) => {
      const match = records.get(id)
      if (match) return match as T & BaseRecord
      throw new Deno.errors.NotFound(`record ${id} not found`)
    },
    find: (predicate: (record: T) => unknown) =>
      records.values().find(predicate) as T & BaseRecord | undefined,
    filter: (predicate: (record: T) => unknown) =>
      records.values().filter(predicate).toArray() as (T & BaseRecord)[],
    async update(id: T[K], changes: Partial<Omit<T, K>>) {
      const record = records.get(id)
      if (!record) throw new Deno.errors.NotFound(`record ${id} not found`)
      const updated = { ...record, ...changes, updatedAt: Date.now() } as T
      records.set(id, updated)
      await saveRecord(updated)
      return updated as T & BaseRecord
    },

    async delete(id: T[K]) {
      const record = records.get(id)
      if (!record) return false
      records.delete(id)
      await Deno.remove(recordFile(id))
      return true
    },
  }
}
