import { get } from './lmdb-store.ts'

// Matches the `Person` shape from tickets.ts (issue 1, a separate branch as
// of this issue) — duplicated rather than imported since this issue has no
// dependency on it.
export type Person = {
  id: string
  name: string
  emails: string[]
  githubLogin?: string
  discordId?: string
  jiraAccountId?: string
}

type GoogleUser = {
  id: string
  primaryEmail: string
  emails: string[]
  name: string
}

type JiraUser = {
  accountId: string
  email: string | null
}

// `name`/`global_name` come back as `[]`, not `null`, when unset on some
// store records (an upstream sync quirk) — typed loosely and guarded with
// `typeof` rather than trusted.
type GithubUser = {
  login: string
  name: unknown
}

type DiscordUser = {
  id: string
  global_name: unknown
}

const GOOGLE_USER_QUERY =
  '{id: .id, primaryEmail: .primaryEmail, emails: [.emails[]?.address], name: .name.fullName}'
const JIRA_USER_QUERY = '{accountId: .accountId, email: .emailAddress}'
const GITHUB_USER_QUERY = '{login: .login, name: .name}'
const DISCORD_USER_QUERY = '{id: .id, global_name: .global_name}'

// github/user and discord/user carry no email to join against google/user
// by, so this falls back to an exact, case-insensitive full-name match —
// the only signal shared with google/user's `name.fullName`. A name shared
// by more than one account is dropped rather than guessed at (e.g. two
// real github accounts both just named "Henri").
const uniqueByName = <T>(
  items: T[],
  getName: (item: T) => unknown,
): Map<string, T> => {
  const byName = new Map<string, T>()
  const ambiguous = new Set<string>()
  for (const item of items) {
    const name = getName(item)
    if (typeof name !== 'string' || !name) continue
    const key = name.toLowerCase()
    if (byName.has(key)) ambiguous.add(key)
    else byName.set(key, item)
  }
  for (const key of ambiguous) byName.delete(key)
  return byName
}

export const mergeTeamDirectory = (
  googleUsers: GoogleUser[],
  jiraUsers: JiraUser[],
  githubUsers: GithubUser[],
  discordUsers: DiscordUser[],
): Person[] => {
  const githubByName = uniqueByName(githubUsers, (u) => u.name)
  const discordByName = uniqueByName(discordUsers, (u) => u.global_name)

  return googleUsers.map((user) => {
    const emails = [...new Set([user.primaryEmail, ...user.emails])]
    const jiraUser = jiraUsers.find((j) => j.email && emails.includes(j.email))
    const nameKey = user.name.toLowerCase()
    return {
      id: user.id,
      name: user.name,
      emails,
      jiraAccountId: jiraUser?.accountId,
      githubLogin: githubByName.get(nameKey)?.login,
      discordId: discordByName.get(nameKey)?.id,
    }
  })
}

export const buildTeamDirectory = async (): Promise<Person[]> => {
  const [googleUsers, jiraUsers, githubUsers, discordUsers] = await Promise
    .all([
      get<GoogleUser[]>('google/user', { q: GOOGLE_USER_QUERY }),
      get<JiraUser[]>('jira/user', { q: JIRA_USER_QUERY }),
      get<GithubUser[]>('github/user', { q: GITHUB_USER_QUERY }),
      get<DiscordUser[]>('discord/user', { q: DISCORD_USER_QUERY }),
    ])
  return mergeTeamDirectory(googleUsers, jiraUsers, githubUsers, discordUsers)
}
