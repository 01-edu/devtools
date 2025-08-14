import { Asserted, makeRouter, route } from '/api/lib/router.ts'
import type { RequestContext } from '/api/lib/context.ts'
import { handleGoogleCallback, initiateGoogleAuth } from './auth.ts'
import {
  ProjectDef,
  ProjectsCollection,
  TeamDef,
  TeamsCollection,
  User,
  UserDef,
} from './schema.ts'
import { ARR, BOOL, OBJ, optional, STR } from './lib/validator.ts'
import { respond } from './lib/response.ts'
import { deleteCookie } from 'jsr:@std/http/cookie'
import { getPicture } from '/api/picture.ts'

const withUserSession = ({ user }: RequestContext) => {
  if (!user) throw Error('Missing user session')
}

const withAdminSession = ({ user }: RequestContext) => {
  if (!user || !user.isAdmin) throw Error('Admin access required')
}

const defs = {
  'GET/api/health': route({
    fn: () => new Response('OK'),
    description: 'Health check endpoint',
  }),
  'GET/api/login': route({
    fn: initiateGoogleAuth,
    description: 'Initiate Google OAuth authentication',
  }),
  'GET/api/auth/google': route({
    fn: handleGoogleCallback,
    description: 'Handle Google OAuth callback',
  }),
  'GET/api/user/me': route({
    authorize: withUserSession,
    fn: ({ user }) => user as User,
    output: UserDef,
    description: 'Handle Google OAuth callback',
  }),
  'GET/api/picture': route({
    fn: (_ctx, { hash }) => getPicture(hash),
    input: OBJ({ hash: STR('hash of the picture') }),
  }),
  'GET/api/logout': route({
    fn: (_ctx: RequestContext) => {
      const response = respond.SeeOther(null, { Location: '/' })
      for (const name of ['session', 'trace']) {
        deleteCookie(response.headers, name, {
          path: '/',
          secure: true,
          httpOnly: true,
        })
      }
      return response
    },
    input: OBJ({}),
    output: OBJ({}),
    description: 'Logout the user',
  }),
  'GET/api/teams': route({
    authorize: withUserSession,
    fn: () => TeamsCollection.values().toArray(),
    output: ARR(TeamDef, 'List of teams'),
    description: 'Get all teams',
  }),
  'POST/api/teams': route({
    authorize: withAdminSession,
    fn: (_ctx, team) =>
      TeamsCollection.insert({
        teamId: team.teamId,
        teamName: team.teamName,
        teamMembers: [],
      }),
    input: OBJ({
      teamId: STR('The ID of the team'),
      teamName: STR('The name of the team'),
    }),
    output: TeamDef,
    description: 'Create a new team',
  }),
  'GET/api/teams/:teamId': route({
    authorize: withUserSession,
    fn: (_ctx, { teamId }) => {
      const team = TeamsCollection.get(teamId)
      if (!team) throw respond.NotFound({ message: 'Team not found' })
      return team
    },
    input: OBJ({ teamId: STR('The ID of the team') }),
    output: TeamDef,
    description: 'Get a team by ID',
  }),
  'PUT/api/teams/:teamId': route({
    authorize: withAdminSession,
    fn: (_ctx, input) => TeamsCollection.update(input.teamId, input),
    input: OBJ({
      teamId: STR('The ID of the team'),
      teamName: STR('The name of the team'),
      teamMembers: optional(
        ARR(
          STR('The user emails of team members'),
          'The list of user emails who are members of the team',
        ),
      ),
    }),
    output: TeamDef,
    description: 'Update a team by ID',
  }),
  'DELETE/api/teams/:teamId': route({
    authorize: withAdminSession,
    fn: (_ctx, { teamId }) => {
      const team = TeamsCollection.get(teamId)
      if (!team) throw respond.NotFound({ message: 'Team not found' })
      TeamsCollection.delete(teamId)
      return true
    },
    input: OBJ({ teamId: STR('The ID of the team') }),
    output: BOOL('Indicates if the team was deleted'),
    description: 'Delete a team by ID',
  }),
  'GET/api/projects': route({
    authorize: withUserSession,
    fn: () => ProjectsCollection.values().toArray(),
    output: ARR(
      OBJ({
        projectId: STR('The unique identifier for the project'),
        projectName: STR('The name of the project'),
        teamId: STR('The ID of the team that owns the project'),
        isPublic: BOOL('Is the project public?'),
        repositoryUrl: optional(STR('The URL of the project repository')),
      }),
      'List of projects',
    ),
    description: 'Get all projects',
  }),
  'POST/api/projects': route({
    authorize: withAdminSession,
    fn: (_ctx, project) => ProjectsCollection.insert(project),
    input: OBJ({
      projectId: STR('The unique identifier for the project'),
      projectName: STR('The name of the project'),
      teamId: STR('The ID of the team that owns the project'),
      isPublic: BOOL('Is the project public?'),
      repositoryUrl: optional(STR('The URL of the project repository')),
    }, 'Create a new project'),
    output: ProjectDef,
    description: 'Create a new project',
  }),
  'GET/api/projects/:projectId': route({
    authorize: withUserSession,
    fn: (_ctx, { projectId }) => {
      const project = ProjectsCollection.get(projectId)
      if (!project) throw respond.NotFound({ message: 'Project not found' })
      return project
    },
    input: OBJ({ projectId: STR('The ID of the project') }),
    output: ProjectDef,
    description: 'Get a project by ID',
  }),
  'PUT/api/projects/:projectId': route({
    authorize: withAdminSession,
    fn: (_ctx, input) => ProjectsCollection.update(input.projectId, input),
    input: OBJ({
      projectId: STR('The unique identifier for the project'),
      projectName: STR('The name of the project'),
      teamId: STR('The ID of the team that owns the project'),
      isPublic: BOOL('Is the project public?'),
      repositoryUrl: optional(STR('The URL of the project repository')),
    }),
    output: ProjectDef,
    description: 'Update a project by ID',
  }),
  'DELETE/api/projects/:projectId': route({
    authorize: withAdminSession,
    fn: (_ctx, { projectId }) => {
      const project = ProjectsCollection.get(projectId)
      if (!project) throw respond.NotFound({ message: 'Project not found' })
      ProjectsCollection.delete(projectId)
      return true
    },
    input: OBJ({ projectId: STR('The ID of the project') }),
    output: BOOL('Indicates if the project was deleted'),
    description: 'Delete a project by ID',
  }),
} as const

export type RouteDefinitions = typeof defs
export const routeHandler = makeRouter(defs).handle
