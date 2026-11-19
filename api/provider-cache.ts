import { log } from '/api/lib/logger.ts'
import type { ProjectScope, Provider, WorkItem } from './tickets.ts'

export type ListCacheOptions = {
  // how long a list() result is served without asking the STORE again
  ttl?: number
  // an entry nobody read for this long is dropped, stale or not
  idleTtl?: number
  // upper bound of cached scopes per provider, least recently read go first
  maxEntries?: number
  // how long to wait before retrying after a failed refresh
  retryDelay?: number
  now?: () => number
  onError?: (error: unknown, context: Record<string, unknown>) => void
}

type Entry = {
  items?: WorkItem[]
  fetchedAt: number
  lastReadAt: number
  retryAt: number
  pending?: Promise<WorkItem[]>
}

const SECOND = 1000
const MINUTE = 60 * SECOND

const logRefreshError: NonNullable<ListCacheOptions['onError']> = (
  error,
  context,
) => log.error('provider-list-refresh-failed', { ...context, error })

// only the fields a provider scopes on, in a fixed order
const scopeKey = (scope: ProjectScope): string =>
  JSON.stringify([
    scope.repositoryUrl ?? null,
    scope.jiraProjectKey ?? null,
    scope.discordChannelId ?? null,
  ])

// Stale-while-revalidate in front of provider.list():
// - fresh (< ttl): served from memory, no STORE call
// - stale: served from memory right away, one refresh runs in the background
// - refresh failure: the stale list stays served, the error is logged and the
//   next attempt waits `retryDelay`
// No timer refreshes anything by itself: a scope nobody asks for costs nothing
// and is dropped after `idleTtl`. Cached arrays are shared with callers, who
// must not mutate them.
export const withListCache = (
  provider: Provider,
  {
    ttl = MINUTE,
    idleTtl = 15 * MINUTE,
    maxEntries = 50,
    retryDelay = 30 * SECOND,
    now = Date.now,
    onError = logRefreshError,
  }: ListCacheOptions = {},
): Provider => {
  const entries = new Map<string, Entry>()

  const evict = (time: number) => {
    for (const [key, entry] of entries) {
      if (time - entry.lastReadAt > idleTtl && !entry.pending) {
        entries.delete(key)
      }
    }
    // Map keeps insertion order and reads re-insert, so the first is the LRU
    for (const key of entries.keys()) {
      if (entries.size <= maxEntries) break
      entries.delete(key)
    }
  }

  // single flight: every caller of the same scope shares one STORE call
  const refresh = (key: string, entry: Entry, scope: ProjectScope) => {
    entry.pending ??= provider.list(scope).then(
      (items) => {
        entry.items = items
        entry.fetchedAt = now()
        entry.pending = undefined
        return items
      },
      (error) => {
        entry.retryAt = now() + retryDelay
        entry.pending = undefined
        onError(error, { provider: provider.id, scope: key })
        throw error
      },
    )
    return entry.pending
  }

  return {
    id: provider.id,
    comments: (item) => provider.comments(item),
    list: (scope) => {
      const time = now()
      const key = scopeKey(scope)
      const entry = entries.get(key) ??
        { fetchedAt: 0, lastReadAt: time, retryAt: 0 }

      entry.lastReadAt = time
      entries.delete(key)
      entries.set(key, entry)
      evict(time)

      // nothing to fall back on yet: wait for the first load, and forget
      // the entry if it fails so the next request tries again
      if (!entry.items) {
        return refresh(key, entry, scope).catch((error) => {
          entries.get(key) === entry && !entry.items && entries.delete(key)
          throw error
        })
      }

      if (time - entry.fetchedAt >= ttl && time >= entry.retryAt) {
        // already logged by refresh, the stale list is served meanwhile
        refresh(key, entry, scope).catch(() => {})
      }
      return Promise.resolve(entry.items)
    },
  }
}
