import { ARR, BOOL, OBJ, optional, STR } from './lib/validator.ts'
import { Asserted } from './lib/router.ts'
import { createCollection } from './lib/json_store.ts'

export const UserDef = OBJ({
  userEmail: STR('The user email address'),
  userFullName: STR('The user login name'),
  userPicture: optional(STR('The user profile picture URL')),
  isAdmin: BOOL('Is the user an admin?'),
}, 'The user schema definition')
export type User = Asserted<typeof UserDef>

export const TeamDef = OBJ({
  teamId: STR('The unique identifier for the team'),
  teamName: STR('The name of the team'),
  teamMembers: ARR(
    STR('The user emails of team members'),
    'The list of user emails who are members of the team',
  ),
}, 'The team schema definition')
export type Team = Asserted<typeof TeamDef>

export const ProjectDef = OBJ({
  projectId: STR('The unique identifier for the project'),
  projectName: STR('The name of the project'),
  teamId: STR('The ID of the team that owns the project'),
  isPublic: BOOL('Is the project public?'),
  repositoryUrl: optional(STR('The URL of the project repository')),
}, 'The project schema definition')
export type Project = Asserted<typeof ProjectDef>

export const UsersCollection = await createCollection<User, 'userEmail'>(
  { name: 'users', primaryKey: 'userEmail' },
)

export const TeamsCollection = await createCollection<Team, 'teamId'>(
  { name: 'teams', primaryKey: 'teamId' },
)

export const ProjectsCollection = await createCollection<Project, 'projectId'>(
  { name: 'projects', primaryKey: 'projectId' },
)
