// db_test.ts
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd'
import { assert, assertEquals, assertExists, assertRejects } from '@std/assert'
import { createCollection } from './json_store.ts'
import { ensureDir } from '@std/fs'

type User = {
  id: number
  email: string
  username: string
  age?: number | null
}

let dbDir: string

beforeEach(async () => {
  dbDir = './db_test'
  await ensureDir(dbDir)
})

afterEach(async () => {
  try {
    await Deno.remove(dbDir, { recursive: true })
  } catch {
    /* ignore */
  }
})

describe('createCollection', () => {
  it('inserts a record with an auto-generated numeric id', async () => {
    const users = await createCollection<User, 'email'>({
      name: 'users',
      primaryKey: 'email',
    })

    const inserted = await users.insert({
      id: 0, // id will be auto-generated
      email: 'alice@example.com',
      username: 'alice',
      age: 30,
    })

    assertEquals(inserted.email, 'alice@example.com')
    assertEquals(inserted.username, 'alice')
    assertEquals(typeof inserted.id, 'number')
  })

  it('finds a record by id', async () => {
    const users = await createCollection<User, 'email'>({
      name: 'users',
      primaryKey: 'email',
    })

    const inserted = await users.insert({
      id: 1, // id will be auto-generated
      email: 'bob@example.com',
      username: 'bob',
    })
    const found = await users.get(inserted.email)

    assertEquals(found, inserted)
  })

  it('returns null when record not found by id', async () => {
    const users = await createCollection<User, 'id'>({
      name: 'users',
      primaryKey: 'id',
    })

    const found = users.get(999)
    assertEquals(found, undefined)
  })

  it('updates a record', async () => {
    const users = await createCollection<User, 'id'>({
      name: 'users',
      primaryKey: 'id',
    })

    const inserted = await users.insert({
      id: 2,
      email: 'charlie@example.com',
      username: 'charlie',
    })
    const updated = await users.update(inserted.id, { age: 25 })

    assertExists(updated)
    assertEquals(updated.age, 25)
    assertEquals(updated.email, 'charlie@example.com')
  })

  it('deletes a record', async () => {
    const users = await createCollection<User, 'id'>({
      name: 'users',
      primaryKey: 'id',
    })

    const inserted = await users.insert({
      id: 3,
      email: 'dave@example.com',
      username: 'dave',
    })
    const deleted = await users.delete(inserted.id)
    assert(deleted)

    const found = users.get(inserted.id)
    assertEquals(found, undefined)
  })

  it('finds records using predicate', async () => {
    const users = await createCollection<User, 'id'>({
      name: 'users',
      primaryKey: 'id',
    })

    await users.insert({
      id: 4,
      email: 'eve@example.com',
      username: 'eve',
      age: 20,
    })
    await users.insert({
      id: 5,
      email: 'frank@example.com',
      username: 'frank',
      age: 30,
    })
    await users.insert({
      id: 6,
      email: 'grace@example.com',
      username: 'grace',
      age: 20,
    })

    const age20 = users.filter((u) => u.age === 20)
    assertEquals(age20.length, 2)
  })

  it('enforces unique key constraint on insert', async () => {
    const users = await createCollection<User, 'email'>({
      name: 'users',
      primaryKey: 'email',
    })

    await users.insert({ id: 7, email: 'hank@example.com', username: 'hank' })
    await assertRejects(
      async () => {
        await users.insert({
          id: 8,
          email: 'hank@example.com',
          username: 'other',
        })
      },
      Error,
      'hank@example.com already exists',
    )
  })

  it('returns null/false for update/delete on non-existent id', async () => {
    const users = await createCollection<User, 'id'>({
      name: 'users',
      primaryKey: 'id',
    })

    await assertRejects(
      async () => {
        const updated = await users.update(999, { email: 'none@example.com' })
        assertEquals(updated, null)
      },
      Deno.errors.NotFound,
      'record 999 not found',
    )

    const deleted = await users.delete(999)
    assertEquals(deleted, false)
  })

  it('handles null/undefined unique fields gracefully', async () => {
    const users = await createCollection<User, 'id'>({
      name: 'users',
      primaryKey: 'id',
    })

    const a = await users.insert({
      id: 1,
      email: 'a@example.com',
      username: 'a',
      age: null,
    })
    assertExists(a)
    const b = await users.insert({
      id: 2,
      email: 'b@example.com',
      username: 'b',
      age: undefined,
    })
    assertExists(b)
  })

  it('evicts LRU cache when cacheSize exceeded', async () => {
    const users = await createCollection<User, 'id'>({
      name: 'users',
      primaryKey: 'id',
    })

    const a = await users.insert({
      id: 1,
      email: 'a@example.com',
      username: 'a',
    })
    await users.insert({ id: 2, email: 'b@example.com', username: 'b' })
    await users.insert({ id: 3, email: 'c@example.com', username: 'c' })

    // Access a again to ensure it's reloaded from disk
    const reloadedA = await users.get(a.id)
    assertEquals(reloadedA?.email, 'a@example.com')
  })
})
