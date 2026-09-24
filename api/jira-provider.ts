import { get } from './lmdb-store.ts'
import type {
  Comment,
  PersonRef,
  ProjectScope,
  Provider,
  WorkItem,
} from './tickets.ts'

type JiraUser = {
  accountId?: string
  emailAddress?: string | null
}

type JiraStatus = {
  name?: string
  iconUrl?: string
} | null

type JiraText = string | Record<string, unknown>

type JiraComment = {
  body?: JiraText
  author?: JiraUser | null
  created?: string
}

type JiraIssue = {
  id?: string
  key?: string
  Project?: {
    key?: string
  } | null

  Summary?: string | null
  Status?: JiraStatus
  Updated?: string
  Created?: string
  Description?: JiraText | null
  Assignee?: JiraUser | null
  Comment?: {
    comments?: JiraComment[]
  } | null
}

type StoreGet = (
  path: string,
  params?: { q?: string },
) => Promise<JiraIssue[]>

const jiraUserRef = (
  user: JiraUser | null | undefined,
): PersonRef | undefined => {
  if (!user?.accountId && !user?.emailAddress) return undefined
  return {
    jiraAccountId: user.accountId,
    email: user.emailAddress ?? undefined,
  }
}

const toWorkItem = (issue: JiraIssue): WorkItem | undefined => {
  if (!issue.id || !issue.key) return undefined

  const assignee = jiraUserRef(issue.Assignee)
  return {
    source: 'jira',
    externalId: issue.id,
    externalUrl: issue.Status?.iconUrl
      ? `${new URL(issue.Status.iconUrl).origin}/browse/${
        encodeURIComponent(issue.key)
      }`
      : `/browse/${encodeURIComponent(issue.key)}`,
    title: issue.Summary ?? issue.key,
    status: typeof issue.Status === 'string'
      ? issue.Status
      : issue.Status?.name,
    updatedAt: issue.Updated ? Date.parse(issue.Updated) : undefined,
    assigneeRefs: assignee ? [assignee] : [],
    raw: issue,
  }
}

const toComment = (
  item: WorkItem,
  body: JiraText | null | undefined,
  author: JiraUser | null | undefined,
  created: string | undefined,
): Comment | undefined => {
  if (typeof body !== 'string' || !body) return undefined
  return {
    source: 'jira',
    author: author?.emailAddress ?? undefined,
    body,
    url: item.externalUrl,
    createdAt: created ? Date.parse(created) : undefined,
  }
}

export const createJiraProvider = (
  storeGet: StoreGet = (path, params) => get<JiraIssue[]>(path, params),
): Provider => ({
  id: 'jira',

  async list(scope: ProjectScope): Promise<WorkItem[]> {
    if (!scope.jiraProjectKey) return []
    const issues = await storeGet('jira/issue', {
      q: `select(.Project.key == "${scope.jiraProjectKey}") | {
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
      }`,
    })
    const items: WorkItem[] = []
    for (const issue of issues) {
      const item = toWorkItem(issue)
      if (item) items.push(item)
    }
    return items
  },

  async comments(item: WorkItem): Promise<Comment[]> {
    const issues = await storeGet('jira/issue', {
      q: `select(.id == "${item.externalId}") | {
        id,
        key,
        Summary,
        Created,
        Description,
        Comment: {
          comments: ((.Comment.comments // []) | map({
            body,
            created,
            author: { emailAddress: .author.emailAddress }
          }))
        }
      }`,
    })

    if (issues.length === 0 || !issues[0]) return []
    const issue = issues[0]

    const comments: Comment[] = []
    const description = toComment(
      item,
      issue.Description,
      undefined,
      issue.Created,
    )
    if (description) comments.push(description)

    for (const record of issue.Comment?.comments ?? []) {
      const comment = toComment(
        item,
        record.body,
        record.author,
        record.created,
      )
      if (comment) comments.push(comment)
    }

    return comments
  },
})

export const jiraProvider = createJiraProvider()
