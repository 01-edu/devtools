export type Source = 'github' | 'jira' | 'discord'

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

const KEY_PATTERN = /^([A-Z]+)[^0-9]?([0-9]+)/

export const normalizeKey = (rawKey: string): string | undefined => {
  const [, prefix, id] = rawKey.toUpperCase().match(KEY_PATTERN) ?? []
  return id ? `${prefix}${id}` : undefined
}

export const extractKey = (item: WorkItem): string | undefined => {
  const raw = item.raw as Record<string, unknown> | undefined
  switch (item.source) {
    case 'jira': {
      const key = raw?.key
      return typeof key === 'string' ? normalizeKey(key) : undefined
    }
    case 'discord': {
      const thread = raw?.thread as { name?: string } | undefined
      return thread?.name ? normalizeKey(thread.name) : undefined
    }
    case 'github':
      return normalizeKey(item.title)
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

export const deriveStatus = (items: WorkItem[]): TicketStatus => {
  const pr = items.find((item) => item.source === 'github')
  if (pr?.status === 'merged') return 'done'
  if (pr?.status === 'open') return 'in_progress'
  const jira = items.find((item) => item.source === 'jira')
  return mapJiraStatus(jira?.status) ?? 'todo'
}

const matchesPersonRef = (ref: PersonRef, person: Person): boolean =>
  (ref.login != null && person.githubLogin === ref.login) ||
  (ref.email != null && person.emails.includes(ref.email)) ||
  (ref.discordId != null && person.discordId === ref.discordId) ||
  (ref.jiraAccountId != null && person.jiraAccountId === ref.jiraAccountId)

function findPersonMatch(this: PersonRef, person: Person): boolean {
  return matchesPersonRef(this, person)
}

export const resolvePerson = (
  directory: Person[],
  ref: PersonRef,
): Person | undefined => directory.find(findPersonMatch, ref)

const resolveUnique = (
  directory: Person[],
  items: WorkItem[],
  personKey: 'assigneeRefs' | 'reviewerRefs',
): Person[] => {
  const persons = new Set<Person>()
  for (const item of items) {
    for (const ref of item[personKey] ?? []) {
      const match = directory.find(findPersonMatch, ref)
      match && persons.add(match)
    }
  }
  return [...persons]
}

const stripKeyPrefix = (title: string, key: string): string => {
  const [prefix, ...rest] = title.split(' ')
  return prefix && normalizeKey(prefix) === key
    ? rest.join(' ') || title
    : title
}

const pickTitle = (items: WorkItem[], key: string): string => {
  const jira = items.find((item) => item.source === 'jira')
  return stripKeyPrefix((jira ?? items[0]).title, key)
}

export const groupIntoTickets = (
  items: WorkItem[],
  directory: Person[],
): Ticket[] => {
  const groups = Map.groupBy(
    items,
    (item) => extractKey(item) || `${item.source}:${item.externalId}`,
  )

  return groups.entries().map(([key, groupItems]) => ({
    key,
    title: pickTitle(groupItems, key),
    status: deriveStatus(groupItems),
    items: groupItems,
    discussion: [],
    assignees: resolveUnique(directory, groupItems, 'assigneeRefs'),
    reviewers: resolveUnique(directory, groupItems, 'reviewerRefs'),
  })).toArray()
}
