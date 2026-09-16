import { assertEquals } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { createJiraProvider } from './jira-provider.ts'

const issue = {
  id: '10001',
  key: 'TNT-393',
  Project: {
    id: '10017',
    key: 'TNT',
    name: 'Tournament',
  },
  Summary: 'Hide settings for no admin tournament user',
  Status: {
    name: 'Done',
  },
  Updated: '2026-01-02T12:00:00.000Z',
  Created: '2026-01-01T12:00:00.000Z',
  Description: 'The settings tab should not be visible to non-admin users.',
  Assignee: {
    accountId: 'jira-account-1',
    emailAddress: 'ada@example.com',
    displayName: 'Ada Lovelace',
  },
  Comment: {
    comments: [
      {
        body: 'Implemented in the tournament frontend.',
        author: {
          accountId: 'jira-account-2',
          emailAddress: 'grace@example.com',
          displayName: 'Grace Hopper',
        },
        created: '2026-01-02T10:00:00.000Z',
      },
    ],
  },
}

describe('jiraProvider', () => {
  it('lists issues scoped by Jira project and maps the assignee', async () => {
    let receivedParams: { q?: string } = {}
    const provider = createJiraProvider((_path, params) => {
      receivedParams = params ?? {}
      return Promise.resolve([issue])
    })

    const items = await provider.list({ jiraProjectKey: 'TNT' })

    assertEquals(receivedParams.q, `select(.Project.key == "TNT") | {
        id,
        key,
        Summary,
        Status: {
          name: .Status.name,
          iconUrl: .Status.iconUrl
        },
        Updated,
        Assignee: {
          accountId: .Assignee.accountId,
          emailAddress: .Assignee.emailAddress
        }
      }`)
    assertEquals(items.length, 1)
    assertEquals(items[0].externalId, '10001')
    assertEquals(items[0].title, issue.Summary)
    assertEquals(items[0].status, issue.Status.name)
    assertEquals(items[0].assigneeRefs, [{
      jiraAccountId: 'jira-account-1',
      email: 'ada@example.com',
    }])
  })

  it('returns no records when the project scope is absent', async () => {
    let called = false
    const provider = createJiraProvider(() => {
      called = true
      return Promise.resolve([issue])
    })

    assertEquals(await provider.list({}), [])
    assertEquals(called, false)
  })

  it('returns description first, followed by Jira comments', async () => {
    const provider = createJiraProvider(() => Promise.resolve([issue]))
    const [item] = await provider.list({ jiraProjectKey: 'TNT' })
    const discussion = await provider.comments(item)

    assertEquals(discussion.map((comment) => comment.body), [
      issue.Description,
      'Implemented in the tournament frontend.',
    ])
    assertEquals(discussion[1].author, 'grace@example.com')
    assertEquals(
      discussion[1].createdAt,
      Date.parse('2026-01-02T10:00:00.000Z'),
    )
  })
})
