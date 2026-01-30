import { makeRouter, route } from '@01edu/api/router'
import type { RequestContext } from '@01edu/api/context'
import { handleGoogleCallback, initiateGoogleAuth } from '/api/auth.ts'
import {
  DatabaseSchemasCollection,
  DeploymentDef,
  DeploymentsCollection,
  ProjectsCollection,
  TeamDef,
  TeamsCollection,
  UserDef,
  UsersCollection,
} from './schema.ts'
import { ARR, BOOL, LIST, NUM, OBJ, optional, STR } from '@01edu/api/validator'
import { respond } from '@01edu/api/response'
import { deleteCookie } from '@std/http/cookie'
import { getPicture } from '/api/picture.ts'
import {
  getLogs,
  insertLogs,
  LogSchemaOutput,
  LogsInputSchema,
} from '/api/clickhouse-client.ts'
import { decodeSession, decryptMessage, encryptMessage } from '/api/user.ts'
import { fetchTablesData, runSQL, SQLQueryError } from '/api/sql.ts'
import { Log } from '@01edu/api/log'

const withUserSession = async ({ cookies }: RequestContext) => {
  const session = await decodeSession(cookies.session)
  if (!session) throw Error('Missing user session')
  return session
}

const withAdminSession = async (ctx: RequestContext) => {
  const session = await withUserSession(ctx)
  if (!session || !session.isAdmin) throw Error('Admin access required')
}

const withDeploymentSession = async (ctx: RequestContext) => {
  const token = ctx.req.headers.get('Authorization')?.replace(/^Bearer /i, '')
  if (!token) throw Error('Missing token')
  const message = await decryptMessage(token)
  if (!message) throw Error('Invalid token')
  const data = JSON.parse(message)
  const dep = DeploymentsCollection.get(data?.url)
  if (!dep || dep.tokenSalt !== data?.tokenSalt) throw Error('Invalid token')
  return dep
}

const userInTeam = (teamId: string, userEmail?: string) => {
  if (!userEmail) return false
  return TeamsCollection.get(teamId)?.teamMembers.includes(userEmail)
}

const deploymentOutput = OBJ({
  projectId: STR('The ID of the project'),
  url: STR('The URL of the deployment'),
  logsEnabled: BOOL('Whether logging is enabled'),
  databaseEnabled: BOOL('Whether the database is enabled'),
  sqlEndpoint: optional(STR('The SQL endpoint')),
  sqlToken: optional(STR('The SQL token')),
  createdAt: optional(NUM('The creation date of the deployment')),
  updatedAt: optional(NUM('The last update date of the deployment')),
  token: optional(STR('The deployment token')),
})

const projectOutput = OBJ({
  slug: STR('The unique identifier for the project'),
  name: STR('The name of the project'),
  teamId: STR('The ID of the team that owns the project'),
  isPublic: BOOL('Is the project public?'),
  repositoryUrl: optional(STR('The URL of the project repository')),
  createdAt: optional(NUM('The creation date of the project')),
  updatedAt: optional(NUM('The last update date of the project')),
})

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
    fn: ({ session }) => session,
    output: UserDef,
    description: 'Get current authenticated user information',
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
  'GET/api/users': route({
    authorize: withAdminSession,
    fn: () => UsersCollection.values().toArray(),
    output: ARR(UserDef, 'List of users'),
    description: 'Get all users',
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
  'GET/api/team': route({
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
  'PUT/api/team': route({
    authorize: withAdminSession,
    fn: (_ctx, input) =>
      TeamsCollection.update(input.teamId, {
        teamName: input.teamName,
        teamMembers: input.teamMembers || undefined,
      }),
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
  'DELETE/api/team': route({
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
    output: ARR(projectOutput, 'List of projects'),
    description: 'Get all projects',
  }),
  'POST/api/project': route({
    authorize: withAdminSession,
    fn: (_ctx, project) => ProjectsCollection.insert(project),
    input: OBJ({
      slug: STR('The unique identifier for the project'),
      name: STR('The name of the project'),
      teamId: STR('The ID of the team that owns the project'),
      isPublic: BOOL('Is the project public?'),
      repositoryUrl: optional(STR('The URL of the project repository')),
    }, 'Create a new project'),
    output: projectOutput,
    description: 'Create a new project',
  }),
  'GET/api/project': route({
    authorize: withUserSession,
    fn: (_ctx, { slug }) => {
      const project = ProjectsCollection.get(slug)
      if (!project) throw respond.NotFound({ message: 'Project not found' })
      return project
    },
    input: OBJ({ slug: STR('The slug of the project') }),
    output: projectOutput,
    description: 'Get a project by ID',
  }),
  'PUT/api/project': route({
    authorize: withAdminSession,
    fn: (_ctx, input) => ProjectsCollection.update(input.slug, input),
    input: OBJ({
      slug: STR('The unique identifier for the project'),
      name: STR('The name of the project'),
      teamId: STR('The ID of the team that owns the project'),
      isPublic: BOOL('Is the project public?'),
      repositoryUrl: optional(STR('The URL of the project repository')),
    }),
    output: projectOutput,
    description: 'Update a project by ID',
  }),
  'DELETE/api/project': route({
    authorize: withAdminSession,
    fn: (_ctx, { slug }) => {
      const project = ProjectsCollection.get(slug)
      if (!project) throw respond.NotFound({ message: 'Project not found' })
      ProjectsCollection.delete(slug)
      return true
    },
    input: OBJ({ slug: STR('The slug of the project') }),
    output: BOOL('Indicates if the project was deleted'),
    description: 'Delete a project by ID',
  }),
  'GET/api/project/deployments': route({
    authorize: withUserSession,
    fn: (_ctx, { project }) => {
      const deployments = DeploymentsCollection.filter((d) =>
        d.projectId === project
      )
      if (!deployments.length) {
        throw respond.NotFound({ message: 'Deployments not found' })
      }
      return deployments.map(({ tokenSalt: _, ...d }) => {
        return {
          ...d,
          token: undefined,
          sqlToken: undefined,
          sqlEndpoint: undefined,
        }
      })
    },
    input: OBJ({ project: STR('The ID of the project') }),
    output: ARR(deploymentOutput, 'List of deployments'),
    description: 'Get deployments by project ID',
  }),
  'GET/api/deployment': route({
    authorize: withAdminSession,
    fn: async (_ctx, url) => {
      const dep = DeploymentsCollection.get(url)
      if (!dep) throw respond.NotFound()
      const { tokenSalt, ...deployment } = dep
      const token = await encryptMessage(
        JSON.stringify({ url: deployment.url, tokenSalt }),
      )
      return {
        ...deployment,
        token,
      }
    },
    input: STR(),
    output: deploymentOutput,
    description: 'Get a deployment by ID',
  }),
  'POST/api/deployment': route({
    authorize: withAdminSession,
    fn: async (_ctx, input) => {
      const tokenSalt = performance.now().toString()
      const { tokenSalt: _, ...deployment } = await DeploymentsCollection
        .insert({
          ...input,
          tokenSalt,
        })
      const token = await encryptMessage(
        JSON.stringify({ url: deployment.url, tokenSalt }),
      )
      return {
        ...deployment,
        token,
      }
    },
    input: DeploymentDef,
    output: deploymentOutput,
    description: 'Create a new deployment',
  }),
  'PUT/api/deployment': route({
    authorize: withAdminSession,
    fn: async (_ctx, input) => {
      const { tokenSalt, ...deployment } = await DeploymentsCollection
        .update(input.url, input)
      const token = await encryptMessage(
        JSON.stringify({ url: deployment.url, tokenSalt }),
      )
      return {
        ...deployment,
        token,
      }
    },
    input: DeploymentDef,
    output: deploymentOutput,
    description: 'Update a deployment by ID',
  }),
  'POST/api/deployment/token/regenerate': route({
    authorize: withAdminSession,
    fn: async (_ctx, { url }) => {
      const dep = DeploymentsCollection.get(url)
      if (!dep) throw respond.NotFound()
      const tokenSalt = performance.now().toString()

      const { tokenSalt: _, ...deployment } = await DeploymentsCollection
        .update(url, { ...dep, tokenSalt })
      const token = await encryptMessage(
        JSON.stringify({ url: deployment.url, tokenSalt }),
      )
      return { ...deployment, token }
    },
    input: OBJ({ url: STR('The URL of the deployment') }),
    output: deploymentOutput,
    description: 'Regenerate a deployment token',
  }),
  'GET/api/deployment/schema': route({
    authorize: withUserSession,
    fn: (_ctx, { url }) => {
      const dep = DeploymentsCollection.get(url)
      if (!dep) throw respond.NotFound({ message: 'Deployment not found' })
      if (!dep.databaseEnabled) {
        throw respond.BadRequest({
          message: 'Database not enabled for deployment',
        })
      }
      const schema = DatabaseSchemasCollection.get(url)
      if (!schema) throw respond.NotFound({ message: 'Schema not cached yet' })
      return schema
    },
    input: OBJ({ url: STR('Deployment URL') }),
    output: OBJ({
      deploymentUrl: STR('Deployment url (matches deployment.url)'),
      dialect: STR('Detected SQL dialect'),
      refreshedAt: STR('ISO datetime of last refresh'),
      tables: ARR(OBJ({
        columns: ARR(OBJ({
          name: STR('Column name'),
          type: STR('Column data type'),
          ordinal: NUM('Column ordinal position'),
        })),
        schema: optional(STR('Schema name')),
        table: STR('Table name'),
      })),
    }, 'Database schema cache for a deployment'),
    description: 'Get cached database schema for a deployment',
  }),
  'DELETE/api/deployment': route({
    authorize: withAdminSession,
    fn: async (_ctx, input) => {
      const dep = DeploymentsCollection.get(input)
      if (!dep) throw respond.NotFound()
      await DeploymentsCollection.delete(input)
      return respond.NoContent()
    },
    input: STR(),
    description: 'Delete a deployment',
  }),
  'POST/api/logs': route({
    authorize: withDeploymentSession,
    fn: (ctx, logs) => {
      if (!ctx.session.url) throw respond.InternalServerError()
      return insertLogs(ctx.session.url, logs)
    },
    input: LogsInputSchema,
    description: 'Insert logs into ClickHouse NB: a Bearer token is required',
  }),
  'POST/api/deployment/logs': route({
    authorize: withUserSession,
    fn: (ctx, params) => {
      const deployment = DeploymentsCollection.get(params.deployment)
      if (!deployment) {
        throw respond.NotFound({ message: 'Deployment not found' })
      }
      if (!deployment.logsEnabled) {
        throw respond.BadRequest({
          message: 'Logging not enabled for deployment',
        })
      }
      const project = ProjectsCollection.get(deployment.projectId)
      if (!project) throw respond.NotFound({ message: 'Project not found' })
      if (!project.isPublic && !ctx.session.isAdmin) {
        if (!userInTeam(project.teamId, ctx.session.userEmail)) {
          throw respond.Forbidden({ message: 'Access to project logs denied' })
        }
      }

      return getLogs(deployment.url, params)
    },
    input: OBJ({
      deployment: STR("The deployment's URL"),
      filter: ARR(
        OBJ({
          key: STR('The column to filter by'),
          comparator: LIST(
            ['=', '!=', '<', '<=', '>', '>=', 'LIKE', 'ILIKE'],
            'The comparison operator',
          ),
          value: STR('The value to filter by'),
        }),
        'The filtering criteria',
      ),
      sort: ARR(
        OBJ({
          key: STR('The column to sort by'),
          order: LIST(['ASC', 'DESC'], 'The sort order (ASC or DESC)'),
        }),
        'The sorting criteria',
      ),
      limit: NUM('The maximum number of rows to return'),
      offset: NUM('The number of rows to skip'),
      search: STR('The search term to filter by'),
    }),
    output: ARR(LogSchemaOutput, 'List of logs'),
    description: 'Get logs from ClickHouse',
  }),
  'POST/api/deployment/table/data': route({
    authorize: withUserSession,
    fn: (ctx, { deployment, table, ...input }) => {
      const dep = DeploymentsCollection.get(deployment)
      if (!dep) {
        throw respond.NotFound({ message: 'Deployment not found' })
      }

      if (!dep.databaseEnabled) {
        throw respond.BadRequest({
          message: 'Database not enabled for deployment',
        })
      }

      const project = ProjectsCollection.get(dep.projectId)
      if (!project) throw respond.NotFound({ message: 'Project not found' })
      if (!project.isPublic && !ctx.session.isAdmin) {
        if (!userInTeam(project.teamId, ctx.session.userEmail)) {
          throw respond.Forbidden({
            message: 'Access to project tables denied',
          })
        }
      }

      const schema = DatabaseSchemasCollection.get(deployment)
      if (!schema) throw respond.NotFound({ message: 'Schema not cached yet' })
      const tableDef = schema.tables.find((t) => t.table === table)
      if (!tableDef) {
        throw respond.NotFound({ message: 'Table not found in schema' })
      }

      try {
        const columnsMap = new Map(tableDef.columns.map((c) => [c.name, c]))
        return fetchTablesData(
          { ...input, deployment: dep, table },
          columnsMap,
        )
      } catch (err) {
        console.error('fetchTablesData-error', { stack: (err as Error)?.stack })
        throw err
      }
    },
    input: OBJ({
      deployment: STR("The deployment's URL"),
      table: STR('The table name'),
      filter: ARR(
        OBJ({
          key: STR('The column to filter by'),
          comparator: LIST(
            ['=', '!=', '<', '<=', '>', '>=', 'LIKE', 'ILIKE'],
            'The comparison operator',
          ),
          value: STR('The value to filter by'),
        }),
        'The filtering criteria',
      ),
      sort: ARR(
        OBJ({
          key: STR('The column to sort by'),
          order: LIST(['ASC', 'DESC'], 'The sort order (ASC or DESC)'),
        }),
        'The sorting criteria',
      ),
      limit: NUM('The maximum number of rows to return'),
      offset: NUM('The number of rows to skip'),
      search: STR('The search term to filter by'),
    }),
    output: OBJ({
      totalRows: NUM('The total number of rows matching the criteria'),
      rows: ARR(OBJ({}, 'A row of the result set'), 'The result set rows'),
    }),
  }),
  'GET/api/deployment/query': route({
    authorize: withUserSession,
    fn: async (ctx, { deployment, sql }) => {
      const dep = DeploymentsCollection.get(deployment)

      if (!dep) {
        throw new respond.NotFoundError({ message: 'Deployment not found' })
      }

      if (!dep.databaseEnabled) {
        throw new respond.BadRequestError({
          message: 'Database not enabled for deployment',
        })
      }

      const project = ProjectsCollection.get(dep.projectId)
      if (!project) throw respond.NotFound({ message: 'Project not found' })
      if (!project.isPublic && !ctx.session.isAdmin) {
        if (!userInTeam(project.teamId, ctx.session.userEmail)) {
          throw new respond.ForbiddenError({
            message: 'Access to project queries denied',
          })
        }
      }

      const { sqlEndpoint, sqlToken } = dep
      if (!sqlEndpoint || !sqlToken) {
        throw new respond.BadRequestError({
          message: 'SQL endpoint or token not configured for deployment',
        })
      }

      try {
        const startTime = performance.now()
        const data = await runSQL(sqlEndpoint, sqlToken, sql)

        return {
          duration: (performance.now() - startTime) / 1000, // in seconds
          rows: data,
        }
      } catch (error) {
        if (error instanceof SQLQueryError) {
          if (error.type === 'bad-query') {
            throw new respond.BadRequestError({
              message: `SQL Query Error: ${error.sqlMessage}`,
            })
          } else if (error.type === 'timeout') {
            throw new respond.BadRequestError({
              message: `SQL Query Timeout: ${error.sqlMessage}`,
            })
          }
        }
        throw respond.InternalServerError()
      }
    },
    input: OBJ({
      deployment: STR("The deployment's URL"),
      sql: STR('The SQL query to execute'),
    }),
    output: OBJ({
      duration: NUM('The duration of the query in seconds'),
      rows: ARR(OBJ({}, 'A row of the result set'), 'The result set rows'),
    }),
    description: 'Run a SQL query against the deployment database',
  }),
} as const

export type RouteDefinitions = typeof defs
export const routeHandler = makeRouter(console as unknown as Log, defs)
