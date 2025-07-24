// zero-db.ts
import { join } from 'jsr:@std/path'
import { APP_ENV } from './env.ts'
import { ensureDir } from 'jsr:@std/fs'

const DB_DIR = APP_ENV === 'test' ? './db' : './db'

type CollectionOptions<T, K extends keyof T> = {
  name: string
  primaryKey: K
  uniqueKeys?: ReadonlyArray<keyof T>
}

type Collection<T, K extends keyof T> = {
  readonly name: string
  readonly primaryKey: K
  init(): Promise<void>
  insert(data: Omit<T, K>): Promise<T>
  findById(id: T[K]): T | null
  find(predicate: (record: T) => boolean): T[]
  update(id: T[K], data: Partial<Omit<T, K>>): Promise<T | null>
  delete(id: T[K]): Promise<boolean>
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = `${filePath}.tmp`
  await Deno.writeTextFile(tmp, content)
  await Deno.rename(tmp, filePath)
}

export function createCollection<
  T extends Record<PropertyKey, unknown>,
  K extends keyof T,
>(options: CollectionOptions<T, K>): Collection<T, K> {
  const { name, primaryKey, uniqueKeys = [] } = options

  const dir = join(DB_DIR, name)
  const metaFile = join(dir, '_meta.json')
  const indices = uniqueKeys.map((key) => ({
    key,
    file: join(dir, `_index_unique_${String(key)}.json`),
  }))

  let nextId = 1
  const records = new Map<T[K], T>()
  const indexes = new Map<keyof T, Map<unknown, T[K]>>()

  const recordFile = (id: T[K]) => join(dir, `${String(id)}.json`)

  async function loadAll() {
    await ensureDir(dir)

    try {
      const m = JSON.parse(await Deno.readTextFile(metaFile)) as {
        nextNumericId: number
      }
      nextId = m.nextNumericId
    } catch { /* first run */ }

    for (const { key, file } of indices) {
      const idx = new Map<unknown, T[K]>()
      try {
        const data = JSON.parse(await Deno.readTextFile(file)) as Record<
          string,
          T[K]
        >
        for (const [k, v] of Object.entries(data)) idx.set(k, v)
      } catch { /* first run */ }
      indexes.set(key, idx)
    }

    for await (const entry of Deno.readDir(dir)) {
      if (
        !entry.isFile || entry.name.startsWith('_') ||
        !entry.name.endsWith('.json')
      ) continue
      const idRaw = entry.name.slice(0, -5)
      const id = (Number.isNaN(Number(idRaw)) ? idRaw : Number(idRaw)) as T[K]

      try {
        const rec = JSON.parse(await Deno.readTextFile(recordFile(id))) as T
        records.set(id, rec)
      } catch { /* corrupted file, ignore */ }
    }
  }

  async function saveRecord(rec: T) {
    const id = rec[primaryKey]
    await atomicWrite(recordFile(id), JSON.stringify(rec, null, 2))
  }

  async function saveMeta() {
    await atomicWrite(
      metaFile,
      JSON.stringify({ nextNumericId: nextId }, null, 2),
    )
  }

  async function saveIndex(key: keyof T) {
    const idx = indexes.get(key)!
    const obj = Object.fromEntries(idx.entries())
    const file = indices.find((i) => i.key === key)!.file
    await atomicWrite(file, JSON.stringify(obj, null, 2))
  }

  return {
    name,
    primaryKey,

    async init() {
      await loadAll()
    },

    async insert(data) {
      const id = nextId as T[K]
      const record = { ...data, [primaryKey]: id } as T

      for (const key of uniqueKeys) {
        const value = record[key]
        const idx = indexes.get(key)!
        if (idx.has(value)) {
          throw new Error(`${String(key)} "${value}" already exists`)
        }
      }

      records.set(id, record)
      for (const key of uniqueKeys) {
        indexes.get(key)!.set(record[key], id)
        await saveIndex(key)
      }
      nextId++
      await saveMeta()
      await saveRecord(record)

      return record
    },

    findById(id) {
      return records.get(id) || null
    },

    find(predicate) {
      return [...records.values()].filter(predicate)
    },

    async update(id, changes) {
      const record = records.get(id)
      if (!record) return null

      for (const key of uniqueKeys) {
        const newVal = (changes as Partial<T>)[key]
        if (newVal === undefined) continue
        const idx = indexes.get(key)!
        if (idx.has(newVal) && idx.get(newVal) !== id) {
          throw new Error(`${String(key)} "${newVal}" already exists`)
        }
      }

      const updated = { ...record, ...changes } as T

      for (const key of uniqueKeys) {
        const newVal = updated[key]
        const oldVal = record[key]
        const idx = indexes.get(key)!
        if (newVal !== oldVal) {
          idx.delete(oldVal)
          idx.set(newVal, id)
          await saveIndex(key)
        }
      }

      records.set(id, updated)
      await saveRecord(updated)
      return updated
    },

    async delete(id) {
      const record = records.get(id)
      if (!record) return false

      for (const key of uniqueKeys) {
        const value = record[key]
        indexes.get(key)!.delete(value)
        await saveIndex(key)
      }

      records.delete(id)
      await Deno.remove(recordFile(id))
      return true
    },
  }
}
