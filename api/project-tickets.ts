import { discordProvider } from './discord-provider.ts'
import { githubProvider } from './github-provider.ts'
import { jiraProvider } from './jira-provider.ts'
import { withListCache } from './provider-cache.ts'
import { buildTeamDirectory } from './team-directory.ts'
import {
  type Comment,
  groupIntoTickets,
  normalizeKey,
  type Person,
  type PersonRef,
  type ProjectScope,
  type Provider,
  resolvePerson,
  type Source,
  type Ticket,
  type TicketStatus,
} from './tickets.ts'

// nullable to take the route's `optional()` params as they are typed
export type TicketFilters = {
  status?: TicketStatus | null
  source?: Source | null
  assignee?: string | null
  reviewer?: string | null
  search?: string | null
}

// list() goes through the cache, so neither the list nor the detail endpoint
// hits the STORE on every request; comments() are only fetched on open
const ticketProviders: Provider[] = [
  jiraProvider,
  githubProvider,
  discordProvider,
].map((provider) => withListCache(provider))

const ticketUpdatedAt = (ticket: Ticket): number =>
  Math.max(0, ...ticket.items.map((item) => item.updatedAt ?? 0))

// latest activity first, then by key so that offset pagination stays stable
// between two requests
const byLatestActivity = (a: Ticket, b: Ticket): number =>
  ticketUpdatedAt(b) - ticketUpdatedAt(a) || a.key.localeCompare(b.key)

const loadTickets = async (
  scope: ProjectScope,
  providers: Provider[],
  loadDirectory: () => Promise<Person[]>,
) => {
  const [directory, ...results] = await Promise.all([
    loadDirectory(),
    ...providers.map((provider) => provider.list(scope)),
  ])
  return { directory, tickets: groupIntoTickets(results.flat(), directory) }
}

// each provider returns [] by itself when its scope field is missing
export const listProjectTickets = async (
  scope: ProjectScope,
  providers: Provider[] = ticketProviders,
  loadDirectory: () => Promise<Person[]> = buildTeamDirectory,
): Promise<Ticket[]> => {
  const { tickets } = await loadTickets(scope, providers, loadDirectory)
  return tickets.sort(byLatestActivity)
}

// comments without a date go last, ties keep the provider order
const byCreatedAt = (a: Comment, b: Comment): number => {
  if (a.createdAt === undefined) return b.createdAt === undefined ? 0 : 1
  if (b.createdAt === undefined) return -1
  return a.createdAt - b.createdAt
}

// what a comment author is, per source (see each provider's toComment)
const authorRef = ({ source, author }: Comment): PersonRef | undefined => {
  if (!author) return undefined
  switch (source) {
    case 'jira':
      return { email: author }
    case 'github':
      return { login: author }
    case 'discord':
      return { discordId: author }
  }
}

export type TicketComment = Omit<Comment, 'author'> & { author?: Person }
export type TicketDetail = Omit<Ticket, 'discussion'> & {
  discussion: TicketComment[]
}

// "tnt-393" finds TNT393, unkeyed tickets are found by their exact key
export const getProjectTicket = async (
  scope: ProjectScope,
  key: string,
  providers: Provider[] = ticketProviders,
  loadDirectory: () => Promise<Person[]> = buildTeamDirectory,
): Promise<TicketDetail | undefined> => {
  const { directory, tickets } = await loadTickets(
    scope,
    providers,
    loadDirectory,
  )
  const wanted = key.trim()
  const normalized = normalizeKey(wanted)
  const ticket = tickets.find((ticket) => ticket.key === wanted) ??
    (normalized
      ? tickets.find((ticket) => ticket.key === normalized)
      : undefined)
  if (!ticket) return undefined

  const bySource = new Map(providers.map((provider) => [provider.id, provider]))
  const threads = await Promise.all(
    ticket.items.map((item) =>
      bySource.get(item.source)?.comments(item) ?? Promise.resolve([])
    ),
  )
  const discussion = threads.flat().sort(byCreatedAt).map((comment) => {
    const ref = authorRef(comment)
    const author = ref ? resolvePerson(directory, ref) : undefined
    return { ...comment, author }
  })
  return { ...ticket, discussion }
}

const hasPerson = (persons: Person[], id: string): boolean =>
  persons.some((person) => person.id === id)

// "tnt-393" or "393" find TNT393, anything else is matched against the title
const matchesSearch = (ticket: Ticket, search: string): boolean => {
  const term = search.trim().toLowerCase()
  const keyTerm = term.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return (keyTerm !== '' && ticket.key.includes(keyTerm)) ||
    ticket.title.toLowerCase().includes(term)
}

export const filterTickets = (
  tickets: Ticket[],
  { status, source, assignee, reviewer, search }: TicketFilters,
): Ticket[] =>
  tickets.filter((ticket) =>
    (!status || ticket.status === status) &&
    (!source || ticket.items.some((item) => item.source === source)) &&
    (!assignee || hasPerson(ticket.assignees, assignee)) &&
    (!reviewer || hasPerson(ticket.reviewers, reviewer)) &&
    (!search || matchesSearch(ticket, search))
  )

const toPersonRow = ({ id, name }: Person) => ({ id, name })

// what leaves the API: no `raw` source record, no raw person refs, no emails
export const toTicketRow = (ticket: Ticket) => ({
  key: ticket.key,
  title: ticket.title,
  status: ticket.status,
  updatedAt: ticketUpdatedAt(ticket) || undefined,
  items: ticket.items.map((item) => ({
    source: item.source,
    externalId: item.externalId,
    externalUrl: item.externalUrl,
    title: item.title,
    status: item.status,
    updatedAt: item.updatedAt,
  })),
  assignees: ticket.assignees.map(toPersonRow),
  reviewers: ticket.reviewers.map(toPersonRow),
})

// the author is only ever exposed as a resolved directory person
export const toTicketDetailRow = (ticket: TicketDetail) => ({
  ...toTicketRow({ ...ticket, discussion: [] }),
  discussion: ticket.discussion.map((comment) => ({
    source: comment.source,
    author: comment.author && toPersonRow(comment.author),
    body: comment.body,
    url: comment.url,
    createdAt: comment.createdAt,
  })),
})
