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

export type PersonLink = {
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

const GOOGLE_USER_QUERY =
  '{id: .id, primaryEmail: .primaryEmail, emails: [.emails[]?.address], name: .name.fullName}'

export const PERSON_LINK_PATH = 'devtools/person-link'

// googleUsers is the identity backbone (id, name, emails); links is the
// manually-entered association table (google user id -> other platform
// ids), filled in by the user themselves or an admin — see
// PUT/api/user/identifiers in routes.ts. Nothing here is inferred/guessed.
export const mergeTeamDirectory = (
  googleUsers: GoogleUser[],
  links: Record<string, PersonLink>,
): Person[] =>
  googleUsers.map((user) => {
    const emails = [...new Set([user.primaryEmail, ...user.emails])]
    return { id: user.id, name: user.name, emails, ...links[user.id] }
  })

export const buildTeamDirectory = async (): Promise<Person[]> => {
  const [googleUsers, links] = await Promise.all([
    get<GoogleUser[]>('google/user', { q: GOOGLE_USER_QUERY }),
    get<(PersonLink & { id: string })[]>(PERSON_LINK_PATH, {}),
  ])
  const linksById = Object.fromEntries(links.map((l) => [l.id, l]))
  return mergeTeamDirectory(googleUsers, linksById)
}
