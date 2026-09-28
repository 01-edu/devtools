import { assertEquals } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { createGithubProvider } from './github-provider.ts'
import { extractKey } from './tickets.ts'

const repositoryUrl = 'https://github.com/01-edu/tournament'
const issue = {
  id: 'issue-node-324',
  number: 324,
  title: 'TNT-393 Hide settings tab for non-admin tournament users',
  body: 'The PR description.',
  state: 'CLOSED',
  mergedAt: '2026-01-03T12:00:00.000Z',
  url: `${repositoryUrl}/pull/324`,
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-03T12:00:00.000Z',
  author: { login: 'ada' },
  participants: [{ login: 'grace' }],
  repository: { name: 'tournament' },
}

describe('githubProvider', () => {
  it('lists repository issues and pulls reviewers from reviews', async () => {
    const received: { path: string; q?: string }[] = []
    const provider = createGithubProvider((path, params) => {
      received.push({ path, q: params?.q })
      if (path === 'github/issue') return Promise.resolve([issue])
      return Promise.resolve([
        { issue: issue.id, author: { login: 'grace' } },
        { issue: issue.id, author: { login: 'grace' } },
        { issue: 'another-issue', author: { login: 'linus' } },
      ])
    })

    const items = await provider.list({ repositoryUrl })

    assertEquals(received.map(({ path }) => path), [
      'github/issue',
      'github/review',
    ])
    assertEquals(
      received[0].q?.includes(
        `.url | startswith("${repositoryUrl}/")`,
      ),
      true,
    )
    assertEquals(items.length, 1)
    assertEquals(items[0].externalId, issue.id)
    assertEquals(items[0].externalUrl, issue.url)
    assertEquals(items[0].title, issue.title)
    assertEquals(items[0].status, 'merged')
    assertEquals(items[0].reviewerRefs, [{ login: 'grace' }])
    assertEquals(
      received[1].q?.includes('.repository.name == "tournament"'),
      true,
    )
    assertEquals(items[0].assigneeRefs, [])
    assertEquals(extractKey(items[0]), 'TNT393')
  })

  it('does not list when repository scope is absent', async () => {
    let called = false
    const provider = createGithubProvider(() => {
      called = true
      return Promise.resolve([])
    })

    assertEquals(await provider.list({}), [])
    assertEquals(called, false)
  })

  it('returns the body first, then comments and reviews chronologically', async () => {
    const received: { path: string; q?: string }[] = []
    const provider = createGithubProvider((path, params) => {
      received.push({ path, q: params?.q })
      if (path === 'github/issue') return Promise.resolve([issue])
      if (path === 'github/comment') {
        return Promise.resolve([
          {
            body: 'A later comment.',
            author: { login: 'ada' },
            createdAt: '2026-01-03T10:00:00.000Z',
          },
          {
            body: 'An earlier comment.',
            author: { login: 'grace' },
            createdAt: '2026-01-02T10:00:00.000Z',
          },
        ])
      }
      return Promise.resolve([
        {
          issue: issue.id,
          body: 'An earlier review.',
          author: { login: 'linus' },
          submittedAt: '2026-01-02T09:00:00.000Z',
        },
        {
          issue: issue.id,
          body: 'A later review.',
          author: { login: 'grace' },
          submittedAt: '2026-01-04T09:00:00.000Z',
        },
      ])
    })
    const [item] = await provider.list({ repositoryUrl })
    const comments = await provider.comments(item)

    assertEquals(received.slice(-2).map(({ path }) => path), [
      'github/comment',
      'github/review',
    ])
    assertEquals(
      received.slice(-2).every(({ q }) =>
        q?.includes(`.issue == "${issue.id}"`)
      ),
      true,
    )
    assertEquals(comments.map((comment) => comment.body), [
      'The PR description.',
      'An earlier review.',
      'An earlier comment.',
      'A later comment.',
      'A later review.',
    ])
    assertEquals(comments.map((comment) => comment.author), [
      'ada',
      'linus',
      'grace',
      'ada',
      'grace',
    ])
  })
})
