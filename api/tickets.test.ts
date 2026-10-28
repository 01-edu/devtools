import { describe, it } from '@std/testing/bdd'
import { assertEquals } from '@std/assert'
import {
  deriveStatus,
  extractKey,
  groupIntoTickets,
  normalizeKey,
  type Person,
  resolvePerson,
  type WorkItem,
} from './tickets.ts'

const jiraItem = (overrides: Partial<WorkItem> = {}): WorkItem => ({
  source: 'jira',
  externalId: 'jira-1',
  externalUrl: 'https://example.atlassian.net/browse/LH92',
  title: 'Fix login bug',
  raw: { key: 'LH-92' },
  ...overrides,
})

const githubItem = (overrides: Partial<WorkItem> = {}): WorkItem => ({
  source: 'github',
  externalId: 'gh-1',
  externalUrl: 'https://github.com/01edu/license-hub/pull/1',
  title: 'LH92 Fix login bug',
  raw: {},
  ...overrides,
})

const discordItem = (overrides: Partial<WorkItem> = {}): WorkItem => ({
  source: 'discord',
  externalId: 'channel-1',
  externalUrl: 'https://discord.com/channels/1/channel-1',
  title: 'LH92 Fix login bug',
  raw: { thread: { name: 'LH92 Fix login bug' } },
  ...overrides,
})

describe('normalizeKey', () => {
  it('normalizes a dashed key and a non-dashed key to the same value', () => {
    assertEquals(normalizeKey('LH-92'), 'LH92')
    assertEquals(normalizeKey('LH92'), 'LH92')
  })

  it('rejects a value with no digits', () => {
    assertEquals(normalizeKey('Fix'), undefined)
    assertEquals(normalizeKey(''), undefined)
  })

  it('extracts the key and ignores trailing dash-joined words', () => {
    // a real branch/PR-title shape: "TNT-879-do-something" is not just
    // the key, but the key is still the leading, extractable part of it
    assertEquals(normalizeKey('TNT-879-do-something'), 'TNT879')
  })
})

describe('extractKey', () => {
  it('reads the key straight off jira.key', () => {
    assertEquals(extractKey(jiraItem()), 'LH92')
  })

  it('reads the key from the discord thread name prefix', () => {
    assertEquals(extractKey(discordItem()), 'LH92')
  })

  it('returns undefined when the discord item has no thread', () => {
    assertEquals(extractKey(discordItem({ raw: {} })), undefined)
  })

  it('reads the key from the github title prefix', () => {
    assertEquals(extractKey(githubItem()), 'LH92')
  })

  it('returns undefined, not a wrong key, when github has no key prefix', () => {
    assertEquals(extractKey(githubItem({ title: 'Fix login bug' })), undefined)
  })

  it('returns undefined when jira.key is missing', () => {
    assertEquals(extractKey(jiraItem({ raw: {} })), undefined)
  })

  it('reads the key from a github title with no space after it', () => {
    // e.g. a branch name used as-is for the title, not "{KEY} {title}"
    assertEquals(
      extractKey(githubItem({ title: 'TNT-879-do-something' })),
      'TNT879',
    )
  })
})

describe('deriveStatus', () => {
  it('is done when the github PR is merged', () => {
    assertEquals(
      deriveStatus([
        jiraItem({ status: 'In Progress' }),
        githubItem({ status: 'merged' }),
      ]),
      'done',
    )
  })

  it('is in_progress when the github PR is open, even if jira says todo', () => {
    assertEquals(
      deriveStatus([
        jiraItem({ status: 'To Do' }),
        githubItem({ status: 'open' }),
      ]),
      'in_progress',
    )
  })

  it('falls back to the mapped jira status with no github item', () => {
    assertEquals(deriveStatus([jiraItem({ status: 'Done' })]), 'done')
  })

  it('defaults to todo with no recognizable signal', () => {
    assertEquals(deriveStatus([]), 'todo')
  })

  it('is in_progress while any PR is open, even next to a merged one', () => {
    assertEquals(
      deriveStatus([
        jiraItem({ status: 'Done' }),
        githubItem({ status: 'merged' }),
        githubItem({ externalId: 'gh-2', status: 'open' }),
      ]),
      'in_progress',
    )
  })

  it('is done when a PR is merged after another was closed unmerged', () => {
    assertEquals(
      deriveStatus([
        jiraItem({ status: 'In Progress' }),
        githubItem({ status: 'closed' }),
        githubItem({ externalId: 'gh-2', status: 'merged' }),
      ]),
      'done',
    )
  })

  it('does not count an open github issue as work in progress', () => {
    assertEquals(
      deriveStatus([
        jiraItem({ status: 'To Do' }),
        githubItem({
          externalUrl: 'https://github.com/01edu/license-hub/issues/2',
          status: 'open',
        }),
      ]),
      'todo',
    )
  })
})

describe('resolvePerson', () => {
  const directory: Person[] = [
    {
      id: 'p1',
      name: 'Ada Lovelace',
      emails: ['ada@example.com'],
      githubLogin: 'ada',
      discordId: 'discord-ada',
      jiraAccountId: 'jira-ada',
    },
  ]

  it('matches by github login', () => {
    assertEquals(resolvePerson(directory, { login: 'ada' })?.id, 'p1')
  })

  it('matches by email', () => {
    assertEquals(
      resolvePerson(directory, { email: 'ada@example.com' })?.id,
      'p1',
    )
  })

  it('returns undefined when nobody matches', () => {
    assertEquals(resolvePerson(directory, { login: 'nobody' }), undefined)
  })
})

describe('groupIntoTickets', () => {
  const directory: Person[] = [
    {
      id: 'p1',
      name: 'Ada Lovelace',
      emails: ['ada@example.com'],
      githubLogin: 'ada',
    },
  ]

  it('merges a jira issue and its github PR into one ticket', () => {
    const tickets = groupIntoTickets(
      [
        jiraItem({ status: 'In Progress' }),
        githubItem({ status: 'open', assigneeRefs: [{ login: 'ada' }] }),
      ],
      directory,
    )

    assertEquals(tickets.length, 1)
    assertEquals(tickets[0].key, 'LH92')
    assertEquals(tickets[0].items.length, 2)
    assertEquals(tickets[0].status, 'in_progress')
    assertEquals(tickets[0].assignees.map((p) => p.id), ['p1'])
  })

  it('merges the items of all three providers sharing a key', () => {
    const tickets = groupIntoTickets(
      [jiraItem(), githubItem({ status: 'open' }), discordItem()],
      directory,
    )

    assertEquals(tickets.length, 1)
    assertEquals(tickets[0].items.map((item) => item.source), [
      'jira',
      'github',
      'discord',
    ])
  })

  const statusCases: [string, string, string][] = [
    ['To Do', 'open', 'in_progress'],
    ['In Progress', 'open', 'in_progress'],
    ['In Progress', 'merged', 'done'],
  ]
  for (const [jiraStatus, prStatus, expected] of statusCases) {
    it(`deduces ${expected} from jira ${jiraStatus} + PR ${prStatus}`, () => {
      const [ticket] = groupIntoTickets(
        [jiraItem({ status: jiraStatus }), githubItem({ status: prStatus })],
        directory,
      )
      assertEquals(ticket.status, expected)
    })
  }

  it('resolves reviewers to deduped people and drops unknown refs', () => {
    const tickets = groupIntoTickets(
      [
        githubItem({ reviewerRefs: [{ login: 'ada' }, { login: 'stranger' }] }),
        githubItem({ externalId: 'gh-2', reviewerRefs: [{ login: 'ada' }] }),
      ],
      directory,
    )

    assertEquals(tickets[0].reviewers, [directory[0]])
  })

  it('keeps an unkeyed item as its own single-item ticket', () => {
    const unkeyed = githubItem({ title: 'Fix login bug' })
    const tickets = groupIntoTickets([unkeyed], [])

    assertEquals(tickets.length, 1)
    assertEquals(tickets[0].key, `${unkeyed.source}:${unkeyed.externalId}`)
    assertEquals(tickets[0].items, [unkeyed])
  })

  it('strips the key prefix from the title regardless of source', () => {
    // no jira item here, so the title falls back to the discord item's —
    // the prefix stripping must not be hardcoded to github specifically
    const tickets = groupIntoTickets([discordItem()], directory)
    assertEquals(tickets[0].title, 'Fix login bug')
  })

  it('dedupes an assignee resolved from more than one item', () => {
    const tickets = groupIntoTickets(
      [
        jiraItem({ assigneeRefs: [{ email: 'ada@example.com' }] }),
        githubItem({ assigneeRefs: [{ login: 'ada' }] }),
      ],
      directory,
    )

    assertEquals(tickets[0].assignees.length, 1)
  })
})
