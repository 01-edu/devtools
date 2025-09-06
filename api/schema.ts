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
  slug: STR('The unique identifier for the project'),
  name: STR('The name of the project'),
  teamId: STR('The ID of the team that owns the project'),
  isPublic: BOOL('Is the project public?'),
  repositoryUrl: optional(STR('The URL of the project repository')),
}, 'The project schema definition')
export type Project = Asserted<typeof ProjectDef>

export const DeploymentDef = OBJ({
  projectId: STR('The ID of the project this deployment belongs to'),
  url: STR('The URL of the deployment'),
  logsEnabled: BOOL('Are logs enabled for this deployment?'),
  databaseEnabled: BOOL('Is the database enabled for this deployment?'),
  sqlEndpoint: optional(STR('The SQL execution endpoint for the database')),
  sqlToken: optional(STR('The security token for the SQL endpoint')),
}, 'The deployment schema definition')
export type Deployment = Asserted<typeof DeploymentDef>

export const UsersCollection = await createCollection<User, 'userEmail'>(
  { name: 'users', primaryKey: 'userEmail' },
)

export const TeamsCollection = await createCollection<Team, 'teamId'>(
  { name: 'teams', primaryKey: 'teamId' },
)

export const ProjectsCollection = await createCollection<
  Project,
  'slug'
>(
  { name: 'projects', primaryKey: 'slug' },
)

export const DeploymentsCollection = await createCollection<
  Deployment & { tokenSalt: string },
  'url'
>(
  { name: 'deployments', primaryKey: 'url' },
)
