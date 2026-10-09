import { get } from './lmdb-store.ts'
import type {
  Comment,
  PersonRef,
  ProjectScope,
  Provider,
  WorkItem,
} from './tickets.ts'

type GithubUser =
  | {
    login?: string
  }
  | null
  | undefined

type GithubIssue = {
  id?: string
  number?: number
  title?: string | null
  body?: string | null
  state?: string
  url?: string
  createdAt?: string
  updatedAt?: string
  mergedAt?: string | null
  author?: GithubUser
  repository?: {
    name?: string
  } | null
  reviews?: {
    nodes?: { id?: string }[]
  } | null
}

type GithubComment = {
  body?: string | null
  author?: GithubUser
  createdAt?: string
  publishedAt?: string
}

type GithubReview = {
  id?: string
  issue?: string
  body?: string | null
  author?: GithubUser
  createdAt?: string
  submittedAt?: string
}

type StoreGet = (
  path: string,
  params?: { q?: string },
) => Promise<GithubIssue[] | GithubComment[] | GithubReview[]>

const toPersonRef = (user: GithubUser): PersonRef | undefined =>
  user?.login ? { login: user.login } : undefined

const toWorkItem = (
  issue: GithubIssue,
  repositoryUrl: string,
  reviews: GithubReview[],
): WorkItem | undefined => {
  if (!issue.id || !issue.title) return undefined

  const issueReviewIds = new Set<string>()
  for (const review of issue.reviews?.nodes ?? []) {
    if (review.id) issueReviewIds.add(review.id)
  }

  const reviewerRefs: PersonRef[] = []
  const reviewerLogins = new Set<string>()
  for (const review of reviews) {
    const matches = review.issue === issue.id ||
      (Boolean(review.id) && issueReviewIds.has(review.id!))
    if (!matches) continue
    const ref = toPersonRef(review.author)
    if (ref?.login && !reviewerLogins.has(ref.login)) {
      reviewerRefs.push(ref)
      reviewerLogins.add(ref.login)
    }
  }

  const status = issue.mergedAt ? 'merged' : issue.state?.toLowerCase()
  return {
    source: 'github',
    externalId: issue.id,
    externalUrl: issue.url ??
      `${repositoryUrl.replace(/\/$/, '')}/issues/${issue.number}`,
    title: issue.title,
    status,
    updatedAt: issue.updatedAt ? Date.parse(issue.updatedAt) : undefined,
    assigneeRefs: [],
    reviewerRefs,
    raw: issue,
  }
}

const toComment = (
  item: WorkItem,
  body: string | null | undefined,
  author: GithubUser,
  createdAt: string | undefined,
): Comment | undefined => {
  if (!body) return undefined
  return {
    source: 'github',
    author: author?.login,
    body,
    url: item.externalUrl,
    createdAt: createdAt ? Date.parse(createdAt) : undefined,
  }
}

const sortChronologically = (comments: Comment[]): Comment[] =>
  comments.map((comment, index) => ({ comment, index }))
    .sort((a, b) => {
      if (a.comment.createdAt === undefined) {
        return b.comment.createdAt === undefined ? a.index - b.index : 1
      }
      if (b.comment.createdAt === undefined) return -1
      return a.comment.createdAt - b.comment.createdAt
    })
    .map(({ comment }) => comment)

export const createGithubProvider = (
  storeGet: StoreGet = (path, params) =>
    get<GithubIssue[] | GithubComment[] | GithubReview[]>(path, params),
): Provider => ({
  id: 'github',

  async list(scope: ProjectScope): Promise<WorkItem[]> {
    if (!scope.repositoryUrl) return []
    const repositoryUrl = new URL(scope.repositoryUrl)
    const repositoryPath = `${repositoryUrl.origin}${
      repositoryUrl.pathname.replace(/\/+$/, '')
    }`
    const repositoryName = repositoryUrl.pathname.split('/').filter(Boolean)
      .at(-1)
    if (!repositoryName) return []

    const [issues, reviews] = await Promise.all([
      storeGet('github/issue', {
        q: `select(.url | startswith(${
          JSON.stringify(`${repositoryPath}/`)
        })) | {
          id,
          number,
          title,
          body,
          state,
          url,
          createdAt,
          updatedAt,
          mergedAt,
          author: { login: .author.login },
          repository: { name: .repository.name },
          reviews: {
            nodes: ((.reviews.nodes // []) | map({ id }))
          }
        }`,
      }),
      storeGet('github/review', {
        q: `select(.repository.name == ${JSON.stringify(repositoryName)}) | {
          id,
          author: { login: .author.login }
        }`,
      }),
    ])

    const githubIssues = issues as GithubIssue[]
    const githubReviews = reviews as GithubReview[]
    const items: WorkItem[] = []
    for (const issue of githubIssues) {
      const item = toWorkItem(issue, scope.repositoryUrl, githubReviews)
      if (item) items.push(item)
    }
    return items
  },

  async comments(item: WorkItem): Promise<Comment[]> {
    const raw = item.raw as GithubIssue | undefined
    const body = toComment(
      item,
      raw?.body,
      raw?.author,
      raw?.createdAt,
    )
    const issueId = JSON.stringify(item.externalId)
    const reviewIds: string[] = []
    for (const review of raw?.reviews?.nodes ?? []) {
      if (review.id) reviewIds.push(review.id)
    }
    const reviewFilter =
      reviewIds.map((id) => `.id == ${JSON.stringify(id)}`).join(' or ') ||
      'false'

    const [issueComments, reviews] = await Promise.all([
      storeGet('github/comment', {
        q: `select(.issue == ${issueId} or .issue.id == ${issueId}) | {
          body,
          author: { login: .author.login },
          createdAt,
          publishedAt
        }`,
      }),
      storeGet('github/review', {
        q: `select(.issue == ${issueId} or ${reviewFilter}) | {
          id,
          body,
          author: { login: .author.login },
          createdAt,
          submittedAt
        }`,
      }),
    ])

    const comments: Comment[] = []
    if (body) comments.push(body)
    for (const comment of issueComments as GithubComment[]) {
      const entry = toComment(
        item,
        comment.body,
        comment.author,
        comment.publishedAt ?? comment.createdAt,
      )
      if (entry) comments.push(entry)
    }
    for (const review of reviews as GithubReview[]) {
      const entry = toComment(
        item,
        review.body,
        review.author,
        review.submittedAt ?? review.createdAt,
      )
      if (entry) comments.push(entry)
    }

    if (!body) return sortChronologically(comments)
    return [body, ...sortChronologically(comments.slice(1))]
  },
})

export const githubProvider = createGithubProvider()
