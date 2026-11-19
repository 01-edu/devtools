import { discordProvider } from './discord-provider.ts'
import { githubProvider } from './github-provider.ts'
import { jiraProvider } from './jira-provider.ts'
import { buildTeamDirectory } from './team-directory.ts'
import {
  groupIntoTickets,
  type Person,
  type ProjectScope,
  type Provider,
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

const ticketProviders: Provider[] = [
  jiraProvider,
  githubProvider,
  discordProvider,
]

const ticketUpdatedAt = (ticket: Ticket): number =>
  Math.max(0, ...ticket.items.map((item) => item.updatedAt ?? 0))

// latest activity first, then by key so that offset pagination stays stable
// between two requests
const byLatestActivity = (a: Ticket, b: Ticket): number =>
  ticketUpdatedAt(b) - ticketUpdatedAt(a) || a.key.localeCompare(b.key)

// each provider returns [] by itself when its scope field is missing
export const listProjectTickets = async (
  scope: ProjectScope,
  providers: Provider[] = ticketProviders,
  loadDirectory: () => Promise<Person[]> = buildTeamDirectory,
): Promise<Ticket[]> => {
  const [directory, ...results] = await Promise.all([
    loadDirectory(),
    ...providers.map((provider) => provider.list(scope)),
  ])
  return groupIntoTickets(results.flat(), directory).sort(byLatestActivity)
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
