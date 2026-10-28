import { assertEquals } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { createDiscordProvider } from './discord-provider.ts'
import { createGithubProvider } from './github-provider.ts'
import { createJiraProvider } from './jira-provider.ts'
import {
  filterTickets,
  listProjectTickets,
  toTicketRow,
} from './project-tickets.ts'
import {
  groupIntoTickets,
  type Person,
  type ProjectScope,
  type Provider,
  type WorkItem,
} from './tickets.ts'

const ada: Person = {
  id: 'p1',
  name: 'Ada Lovelace',
  emails: ['ada@example.com'],
  githubLogin: 'ada',
}
const grace: Person = {
  id: 'p2',
  name: 'Grace Hopper',
  emails: ['grace@example.com'],
  githubLogin: 'grace',
}
const directory = [ada, grace]

const jira = (key: string, overrides: Partial<WorkItem> = {}): WorkItem => ({
  source: 'jira',
  externalId: `jira-${key}`,
  externalUrl: `https://example.atlassian.net/browse/${key}`,
  title: `Jira ${key}`,
  raw: { key },
  ...overrides,
})

const pr = (title: string, overrides: Partial<WorkItem> = {}): WorkItem => ({
  source: 'github',
  externalId: `gh-${title}`,
  externalUrl: 'https://github.com/01-edu/tournament/pull/1',
  title,
  status: 'open',
  raw: {},
  ...overrides,
})

const fakeProvider = (id: Provider['id'], items: WorkItem[]) => {
  const scopes: ProjectScope[] = []
  const provider: Provider = {
    id,
    list: (scope) => {
      scopes.push(scope)
      return Promise.resolve(items)
    },
    comments: () => Promise.resolve([]),
  }
  return { provider, scopes }
}

describe('listProjectTickets', () => {
  it('merges every provider and sorts by latest activity first', async () => {
    const scope = { jiraProjectKey: 'TNT', repositoryUrl: 'https://x/y' }
    const jiraSide = fakeProvider('jira', [
      jira('TNT-1', { updatedAt: 100 }),
      jira('TNT-2', { updatedAt: 300 }),
      jira('TNT-3', { updatedAt: 300 }),
    ])
    const githubSide = fakeProvider('github', [
      pr('TNT-1 Fix it', { updatedAt: 500 }),
    ])

    const tickets = await listProjectTickets(
      scope,
      [jiraSide.provider, githubSide.provider],
      () => Promise.resolve(directory),
    )

    assertEquals(jiraSide.scopes, [scope])
    assertEquals(githubSide.scopes, [scope])
    // TNT1 has the newest item (its PR), TNT2/TNT3 tie and fall back to key
    assertEquals(tickets.map((ticket) => ticket.key), [
      'TNT1',
      'TNT2',
      'TNT3',
    ])
    assertEquals(tickets[0].items.length, 2)
  })

  it('only queries the providers whose scope field is set', async () => {
    const paths: string[] = []
    const store = (path: string) => {
      paths.push(path)
      return Promise.resolve(
        path === 'jira/issue'
          ? [{ id: '1', key: 'TNT-1', Summary: 'Only in Jira' }]
          : [],
      )
    }

    const tickets = await listProjectTickets(
      { jiraProjectKey: 'TNT' },
      [
        createJiraProvider(store),
        createGithubProvider(store),
        createDiscordProvider(store),
      ],
      () => Promise.resolve([]),
    )

    assertEquals(paths, ['jira/issue'])
    assertEquals(tickets.map((ticket) => ticket.key), ['TNT1'])
  })
})

describe('filterTickets', () => {
  const tickets = groupIntoTickets(
    [
      jira('TNT-393', {
        title: 'Hide settings for non admin users',
        status: 'Done',
        assigneeRefs: [{ email: 'ada@example.com' }],
      }),
      pr('TNT-393 Hide settings tab', {
        status: 'merged',
        reviewerRefs: [{ login: 'grace' }],
      }),
      jira('TNT-12', { title: 'Add a leaderboard', status: 'To Do' }),
      pr('Bump dependencies'),
    ],
    directory,
  )
  const keys = (filtered = tickets) => filtered.map((ticket) => ticket.key)

  it('returns everything without filters', () => {
    assertEquals(keys(filterTickets(tickets, {})), keys())
  })

  it('filters by deduced status', () => {
    assertEquals(keys(filterTickets(tickets, { status: 'done' })), ['TNT393'])
    assertEquals(keys(filterTickets(tickets, { status: 'todo' })), ['TNT12'])
  })

  it('filters on tickets that have an item from a source', () => {
    assertEquals(keys(filterTickets(tickets, { source: 'jira' })), [
      'TNT393',
      'TNT12',
    ])
  })

  it('filters by assignee and reviewer person id', () => {
    assertEquals(keys(filterTickets(tickets, { assignee: 'p1' })), ['TNT393'])
    assertEquals(keys(filterTickets(tickets, { reviewer: 'p2' })), ['TNT393'])
    assertEquals(keys(filterTickets(tickets, { reviewer: 'p1' })), [])
  })

  it('searches the key in any notation, and the title', () => {
    assertEquals(keys(filterTickets(tickets, { search: 'tnt-393' })), [
      'TNT393',
    ])
    assertEquals(keys(filterTickets(tickets, { search: '12' })), ['TNT12'])
    assertEquals(keys(filterTickets(tickets, { search: 'LEADER' })), [
      'TNT12',
    ])
  })

  it('combines filters', () => {
    assertEquals(
      keys(filterTickets(tickets, { source: 'jira', status: 'todo' })),
      ['TNT12'],
    )
  })

  it('ignores filters left null', () => {
    assertEquals(
      keys(filterTickets(tickets, { status: null, search: null })),
      keys(),
    )
  })
})

describe('toTicketRow', () => {
  it('keeps raw records, person refs and emails out of the response', () => {
    const [ticket] = groupIntoTickets(
      [
        jira('TNT-1', {
          updatedAt: 100,
          assigneeRefs: [{ email: 'ada@example.com' }],
        }),
        pr('TNT-1 Fix it', {
          updatedAt: 200,
          reviewerRefs: [{ login: 'grace' }],
        }),
      ],
      directory,
    )

    const row = toTicketRow(ticket)

    assertEquals(row.updatedAt, 200)
    assertEquals(row.assignees, [{ id: 'p1', name: 'Ada Lovelace' }])
    assertEquals(row.reviewers, [{ id: 'p2', name: 'Grace Hopper' }])
    assertEquals(
      row.items.every((item) =>
        !('raw' in item) && !('assigneeRefs' in item) &&
        !('reviewerRefs' in item)
      ),
      true,
    )
    assertEquals('discussion' in row, false)
  })
})
