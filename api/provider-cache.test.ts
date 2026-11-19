import { assertEquals, assertRejects, assertStrictEquals } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { type ListCacheOptions, withListCache } from './provider-cache.ts'
import type { ProjectScope, Provider, WorkItem } from './tickets.ts'

const item = (externalId: string): WorkItem => ({
  source: 'jira',
  externalId,
  externalUrl: `https://example.atlassian.net/browse/${externalId}`,
  title: externalId,
})

// a provider whose list() answers are queued by the test, one per call
const setup = (options: ListCacheOptions = {}) => {
  let time = 0
  const calls: ProjectScope[] = []
  const answers: (() => Promise<WorkItem[]>)[] = []
  const errors: unknown[] = []
  const provider: Provider = {
    id: 'jira',
    list: (scope) => {
      calls.push(scope)
      const answer = answers.shift()
      return answer ? answer() : Promise.resolve([item(`call-${calls.length}`)])
    },
    comments: () => Promise.resolve([]),
  }
  const cached = withListCache(provider, {
    ttl: 100,
    idleTtl: 1000,
    retryDelay: 50,
    now: () => time,
    onError: (error) => errors.push(error),
    ...options,
  })
  return {
    cached,
    calls,
    errors,
    answers,
    tick: (ms: number) => (time += ms),
    fail: (message: string) =>
      answers.push(() => Promise.reject(new Error(message))),
  }
}

const tnt = { jiraProjectKey: 'TNT' }
const ids = (items: WorkItem[]) => items.map((entry) => entry.externalId)
// let the background refresh settle
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('withListCache', () => {
  it('serves list() from cache within the ttl', async () => {
    const { cached, calls, tick } = setup()

    const first = await cached.list(tnt)
    tick(99)
    const second = await cached.list(tnt)

    assertEquals(calls.length, 1)
    assertStrictEquals(second, first)
  })

  it('keys the cache on the scope', async () => {
    const { cached, calls } = setup()

    await cached.list(tnt)
    await cached.list({ jiraProjectKey: 'DEV' })
    await cached.list({ jiraProjectKey: 'TNT' })

    assertEquals(calls, [tnt, { jiraProjectKey: 'DEV' }])
  })

  it('shares one STORE call between concurrent first loads', async () => {
    const { cached, calls } = setup()

    const [a, b] = await Promise.all([cached.list(tnt), cached.list(tnt)])

    assertEquals(calls.length, 1)
    assertStrictEquals(a, b)
  })

  it('serves stale data right away and refreshes in the background', async () => {
    const { cached, calls, tick } = setup()

    await cached.list(tnt)
    tick(100)
    assertEquals(ids(await cached.list(tnt)), ['call-1'])
    assertEquals(calls.length, 2)

    await flush()
    assertEquals(ids(await cached.list(tnt)), ['call-2'])
    assertEquals(calls.length, 2)
  })

  it('starts a single refresh while one is already running', async () => {
    const { cached, calls, tick } = setup()

    await cached.list(tnt)
    tick(100)
    await Promise.all([cached.list(tnt), cached.list(tnt), cached.list(tnt)])

    assertEquals(calls.length, 2)
  })

  it('keeps serving stale data and logs when a refresh fails', async () => {
    const { cached, calls, errors, tick, fail } = setup()

    await cached.list(tnt)
    tick(100)
    fail('store down')
    assertEquals(ids(await cached.list(tnt)), ['call-1'])
    await flush()

    assertEquals(ids(await cached.list(tnt)), ['call-1'])
    assertEquals(errors.map((error) => (error as Error).message), [
      'store down',
    ])

    // no retry storm: the next attempt waits retryDelay
    tick(49)
    await cached.list(tnt)
    assertEquals(calls.length, 2)
    tick(1)
    await cached.list(tnt)
    await flush()
    assertEquals(calls.length, 3)
    assertEquals(ids(await cached.list(tnt)), ['call-3'])
  })

  it('throws when the first load fails, and retries on the next call', async () => {
    const { cached, calls, errors, fail } = setup()

    fail('store down')
    await assertRejects(() => cached.list(tnt), Error, 'store down')
    assertEquals(errors.length, 1)

    assertEquals(ids(await cached.list(tnt)), ['call-2'])
    assertEquals(calls.length, 2)
  })

  it('drops the least recently read scope above maxEntries', async () => {
    const { cached, calls } = setup({ maxEntries: 2 })
    const scope = (key: string) => ({ jiraProjectKey: key })

    await cached.list(scope('A'))
    await cached.list(scope('B'))
    await cached.list(scope('A')) // B is now the least recently read
    await cached.list(scope('C')) // evicts B
    await cached.list(scope('A'))
    await cached.list(scope('B'))

    assertEquals(calls.map((call) => call.jiraProjectKey), ['A', 'B', 'C', 'B'])
  })

  it('drops scopes nobody read within idleTtl', async () => {
    const { cached, calls, tick } = setup({ ttl: 10_000 })

    await cached.list(tnt)
    tick(1001)
    await cached.list({ jiraProjectKey: 'DEV' }) // sweeps the idle TNT entry
    await cached.list(tnt)

    assertEquals(calls.map((call) => call.jiraProjectKey), [
      'TNT',
      'DEV',
      'TNT',
    ])
  })

  it('passes comments() through untouched', async () => {
    const comment = { source: 'jira' as const, body: 'hi' }
    const cached = withListCache({
      id: 'jira',
      list: () => Promise.resolve([]),
      comments: () => Promise.resolve([comment]),
    })

    assertEquals(await cached.comments(item('TNT-1')), [comment])
    assertEquals(cached.id, 'jira')
  })
})
