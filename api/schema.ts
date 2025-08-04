import { ARR, BOOL, LIST, NUM, OBJ, optional, STR } from './lib/validator.ts'
import { Asserted } from './lib/router.ts'
import { createCollection } from './lib/json_store.ts'

export const UserDef = OBJ({
  userEmail: STR('The user email address'),
  userFullName: STR('The user login name'),
  userPicture: optional(STR('The user profile picture URL')),
  isAdmin: BOOL('Is the user an admin?'),
  authorizedProjects: ARR(
    STR('The IDs of the projects the user is authorized to access'),
    'The list of project IDs the user is authorized to access',
  ),
}, 'The user schema definition')
export type User = Asserted<typeof UserDef>

export const BetterStackConfigDef = OBJ({
  apiToken: STR('The API token for BetterStack'),
  sourceId: STR('The source ID for BetterStack'),
}, 'The BetterStack configuration schema')
export type BetterStackConfig = Asserted<typeof BetterStackConfigDef>

export const PlatformEndpointsDef = OBJ({
  sqlExecution: STR('The SQL execution endpoint'),
  healthCheck: STR('The health check endpoint'),
}, 'The platform endpoints configuration')
export type PlatformEndpoints = Asserted<typeof PlatformEndpointsDef>

export const SecurityConfigDef = OBJ({
  sharedSecret: STR('The shared secret for security'),
}, 'The security configuration schema')
export type SecurityConfig = Asserted<typeof SecurityConfigDef>

export const ProjectDef = OBJ({
  slug: STR('The project ID'),
  name: STR('The project name'),
  deployementUrl: STR('The project platform URL'),
  logging: optional(OBJ({
    provider: STR('The logging provider'),
    config: BetterStackConfigDef,
  })),
  endpoints: optional(PlatformEndpointsDef),
  security: optional(SecurityConfigDef),
  env: LIST(['dev', 'prod'], 'The environment of the project'),
  createdAt: NUM('The creation date of the project'),
}, 'The project schema definition')

export type Project = Asserted<typeof ProjectDef>

export const UsersStore = await createCollection<User, 'userEmail'>(
  { name: 'users', primaryKey: 'userEmail' },
)

export const ProjectsStore = await createCollection<Project, 'slug'>(
  { name: 'projects', primaryKey: 'slug' },
)

