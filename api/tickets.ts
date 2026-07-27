// Types and pure logic for the read-only, cross-source task manager
// aggregator. See TASK_MANAGER_INTEGRATION.md for the design this
// implements (§1-§4) and TASK_MANAGER_ISSUES.md, issue 1.

export type Source = 'github' | 'jira' | 'discord'

// Whatever identifier a source hands us — resolved against the team
// directory in resolvePerson, never shown to a user as-is.
export type PersonRef = {
  login?: string
  email?: string
  discordId?: string
  jiraAccountId?: string
}

export type Person = {
  id: string
  name: string
  emails: string[]
  githubLogin?: string
  discordId?: string
  jiraAccountId?: string
}

export type WorkItem = {
  source: Source
  externalId: string
  externalUrl: string
  title: string
  status?: string
  updatedAt?: number
  assigneeRefs?: PersonRef[]
  reviewerRefs?: PersonRef[]
  raw?: unknown
}

export type Comment = {
  source: Source
  author?: string
  body: string
  url?: string
  createdAt?: number
}

export type TicketStatus = 'todo' | 'in_progress' | 'done'

// Produced by the aggregator, never stored — always recomputed from
// WorkItem[].
export type Ticket = {
  key: string
  title: string
  status: TicketStatus
  items: WorkItem[]
  discussion: Comment[]
  assignees: Person[]
  reviewers: Person[]
}

export type ProjectScope = {
  repositoryUrl?: string
  jiraProjectKey?: string
  discordChannelId?: string
}

export interface Provider {
  id: Source
  list(scope: ProjectScope): Promise<WorkItem[]>
  comments(item: WorkItem): Promise<Comment[]>
}

// A real ticket key is always {LETTERS}{DIGITS} once normalized (e.g.
// LH92, SUP2078) — enforcing the shape here means a source that doesn't
// follow the naming convention yields no key, never a wrong one.
const KEY_SHAPE = /^[A-Z]+[0-9]+$/

export const normalizeKey = (rawKey: string): string | undefined => {
  const normalized = rawKey.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return KEY_SHAPE.test(normalized) ? normalized : undefined
}

export const extractKey = (item: WorkItem): string | undefined => {
  const raw = item.raw as Record<string, unknown> | undefined
  switch (item.source) {
    case 'jira': {
      const key = raw?.key
      return typeof key === 'string' ? normalizeKey(key) : undefined
    }
    case 'discord': {
      // The thread name is prefixed with the key, e.g. "LH92 Fix bug".
      const thread = raw?.thread as { name?: string } | undefined
      const [prefix] = thread?.name?.split(' ') ?? []
      return prefix ? normalizeKey(prefix) : undefined
    }
    case 'github': {
      // The title is prefixed with the key by convention, same idea.
      const [prefix] = item.title.split(' ')
      return prefix ? normalizeKey(prefix) : undefined
    }
    default: {
      const exhaustive: never = item.source
      return exhaustive
    }
  }
}

const JIRA_STATUS_MAP: Record<string, TicketStatus> = {
  'to do': 'todo',
  'todo': 'todo',
  'backlog': 'todo',
  'in progress': 'in_progress',
  'in review': 'in_progress',
  'done': 'done',
  'closed': 'done',
  'resolved': 'done',
}

const mapJiraStatus = (status?: string): TicketStatus | undefined =>
  status ? JIRA_STATUS_MAP[status.toLowerCase()] : undefined

// A GitHub PR is stronger evidence of real progress than Jira's own status
// column, so it takes priority when both are present. Recomputed from the
// current state of each source every time — nothing is stored, so a
// reopened PR simply stops being "merged" on the next read and the
// deduced status drops back down on its own.
export const deriveStatus = (items: WorkItem[]): TicketStatus => {
  const pr = items.find((item) => item.source === 'github')
  if (pr?.status === 'merged') return 'done'
  if (pr?.status === 'open') return 'in_progress'
  const jira = items.find((item) => item.source === 'jira')
  return mapJiraStatus(jira?.status) ?? 'todo'
}

export const resolvePerson = (
  directory: Person[],
  ref: PersonRef,
): Person | undefined =>
  directory.find((person) =>
    (ref.login != null && person.githubLogin === ref.login) ||
    (ref.email != null && person.emails.includes(ref.email)) ||
    (ref.discordId != null && person.discordId === ref.discordId) ||
    (ref.jiraAccountId != null && person.jiraAccountId === ref.jiraAccountId)
  )

// A ref that fails to resolve (nobody in the directory matches) is
// dropped rather than shown as a raw login/email — the point is one
// unified list of people, not a leak of per-source identifiers.
const resolveUnique = (directory: Person[], refs: PersonRef[]): Person[] => {
  const resolved = refs
    .map((ref) => resolvePerson(directory, ref))
    .filter((person): person is Person => person != null)
  return [...new Map(resolved.map((person) => [person.id, person])).values()]
}

const pickTitle = (items: WorkItem[]): string => {
  const jira = items.find((item) => item.source === 'jira')
  if (jira) return jira.title

  const github = items.find((item) => item.source === 'github')
  if (github) {
    const withoutKeyPrefix = github.title.split(' ').slice(1).join(' ')
    return withoutKeyPrefix || github.title
  }

  return items[0].title
}

// Groups WorkItems into Tickets by their canonical key (see extractKey);
// an item with no extractable key surfaces as its own single-item Ticket
// instead of being dropped. Pure: no I/O, discussion is always empty here
// — populating it requires calling Provider.comments(), which belongs to
// the aggregator that wires providers together, not this module.
export const groupIntoTickets = (
  items: WorkItem[],
  directory: Person[],
): Ticket[] => {
  const groups = Map.groupBy(
    items,
    (item) => extractKey(item) ?? `${item.source}:${item.externalId}`,
  )

  return groups.entries().map(([key, groupItems]) => ({
    key,
    title: pickTitle(groupItems),
    status: deriveStatus(groupItems),
    items: groupItems,
    discussion: [],
    assignees: resolveUnique(
      directory,
      groupItems.flatMap((item) => item.assigneeRefs ?? []),
    ),
    reviewers: resolveUnique(
      directory,
      groupItems.flatMap((item) => item.reviewerRefs ?? []),
    ),
  })).toArray()
}
