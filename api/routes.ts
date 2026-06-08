import { makeRouter, route } from '@01edu/api/router'
import type { RequestContext } from '@01edu/api/context'
import { fetchJson } from '/api/lib/fetcher.ts'
import { handleGoogleCallback, initiateGoogleAuth } from '/api/auth.ts'
import {
  AdminsCollection,
  DatabaseSchemasCollection,
  DeploymentDef,
  DeploymentsCollection,
  ProjectsCollection,
  TeamDef,
  TeamDetailDef,
  User,
  UserDef,
} from '/api/schema.ts'
import {
  ARR,
  BOOL,
  LIST,
  NUM,
  OBJ,
  optional,
  STR,
  UNION,
} from '@01edu/api/validator'
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
import {
  fetchTablesData,
  insertTableData,
  runSQL,
  SQLQueryError,
  updateTableData,
} from '/api/sql.ts'
import { isLocal } from '/api/lib/env.ts'
import { get, getOne } from './lmdb-store.ts'
import { log } from '/api/lib/logger.ts'
import { analyzeQueryWithAI } from '/api/fix-query.ts'

const MetricSchema = OBJ({
  query: STR('The SQL query text'),
  count: NUM('How many times the query has run'),
  duration: NUM('Total time spent running the query in milliseconds'),
  max: NUM('Longest single query execution in milliseconds'),
  explain: ARR(
    OBJ({
      id: NUM('Query plan node id'),
      parent: NUM('Parent query plan node id'),
      detail: STR('Human-readable query plan detail'),
    }),
    'SQLite EXPLAIN QUERY PLAN rows',
  ),
  status: OBJ({
    fullscanStep: NUM('Number of full table scan steps'),
    sort: NUM('Number of sort operations'),
    autoindex: NUM('Rows inserted into transient auto-indices'),
    vmStep: NUM('Number of virtual machine operations'),
    reprepare: NUM('Number of automatic statement reprepares'),
    run: NUM('Number of statement runs'),
    filterHit: NUM('Bloom filter bypass hits'),
    filterMiss: NUM('Bloom filter misses'),
    memused: NUM('Peak memory usage in bytes'),
  }, 'SQLite sqlite3_stmt_status counters'),
})

const localUser = {
  id: 'local', // this id is for local env, it will ignore permissions
  email: 'local@admin.dev',
  fullName: 'Local Dev',
  picture: '',
  isAdmin: true,
} as const

const withUserSession = isLocal
  ? () => localUser
  : async ({ cookies }: RequestContext) => {
    const session = await decodeSession(cookies.session)
    if (!session) {
      log.warn('auth-missing-session')
      throw new respond.UnauthorizedError({ message: 'Missing user session' })
    }
    const admin = AdminsCollection.get(session.id)
    return { ...session, isAdmin: !!admin }
  }

const withAdminSession = async (ctx: RequestContext) => {
  const session = await withUserSession(ctx)
  if (!session || !session.isAdmin) {
    log.warn('auth-admin-required', { userId: session?.id })
    throw new respond.ForbiddenError({ message: 'Admin access required' })
  }
}

const withDeploymentSession = async (ctx: RequestContext) => {
  const token = ctx.req.headers.get('Authorization')?.replace(/^Bearer /i, '')
  if (!token) {
    log.warn('deployment-auth-missing-token')
    throw new respond.UnauthorizedError({ message: 'Missing token' })
  }

  if (isLocal) {
    const dep = DeploymentsCollection.get(token)
    if (!dep) throw new respond.UnauthorizedError({ message: 'Invalid token' })
    return dep
  }

  try {
    const message = await decryptMessage(token)
    if (!message) {
      log.warn('deployment-auth-invalid-token')
      throw new respond.UnauthorizedError({ message: 'Invalid token' })
    }
    const data = JSON.parse(message)
    const dep = DeploymentsCollection.get(data?.url)
    if (!dep || dep.tokenSalt !== data?.tokenSalt) {
      log.warn('deployment-auth-token-mismatch', { url: data?.url })
      throw new respond.UnauthorizedError({ message: 'Invalid token' })
    }
    return dep
  } catch (err) {
    if (err instanceof respond.ResponseError) throw err
    log.warn('deployment-auth-token-error', {
      error: err instanceof Error ? err.message : String(err),
    })
    throw new respond.UnauthorizedError({ message: 'Invalid token' })
  }
}

const userInTeam = async (teamId: string, userId?: string) => {
  if (!userId) return false
  const matches = await getOne<{ id: string }>(
    `google/group/${teamId}`,
    userId,
  )
  return !!matches
}

const withDeploymentTableAccess = async (
  ctx: RequestContext & { session: User },
  deployment: string,
) => {
  const dep = DeploymentsCollection.get(deployment)
  if (!dep) throw new respond.NotFoundError({ message: 'Deployment not found' })

  if (!dep.databaseEnabled) {
    throw new respond.BadRequestError({
      message: 'Database not enabled for deployment',
    })
  }

  const project = ProjectsCollection.get(dep.projectId)
  if (!project) {
    throw new respond.NotFoundError({ message: 'Project not found' })
  }
  if (!project.isPublic && !ctx.session.isAdmin) {
    if (!(await userInTeam(project.teamId, ctx.session.id))) {
      throw new respond.ForbiddenError({
        message: 'Access to project tables denied',
      })
    }
  }
  return dep
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

const apiDocOutputDef = ARR(
  OBJ({
    method: LIST(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], 'HTTP method'),
    path: STR('API endpoint path'),
    requiresAuth: BOOL('whether authentication is required'),
    authFunction: optional(STR('name of the authorization function')),
    description: optional(STR('Endpoint description')),
    input: optional(OBJ({}, 'Input documentation structure')),
    output: optional(OBJ({}, 'Output documentation structure')),
  }, 'API documentation object structure'),
  'API documentation array',
)

const userNameCache = new Map<string, string>()
const getUserName = async (userId: string) => {
  if (userNameCache.has(userId)) return userNameCache.get(userId)
  const user = await getOne<{ name: { fullName: string } }>(
    'google/user',
    userId,
  )
  const name = user?.name?.fullName ?? userId
  userNameCache.set(userId, name)
  return name
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
  'GET/api/teams': route({
    authorize: withUserSession,
    fn: async () => {
      if (isLocal) return [{ id: 'local', name: 'Local', members: [] }]

      const groups = await get<{ id: string; name: string }[]>(
        'google/group',
        {
          q: 'select((.kind == "admin#directory#group") and (.email | endswith("@01edu.ai")) and (.directMembersCount > 1)) | { id: .id, name: .name }',
        },
      )

      const teams = await Promise.all(
        groups.map(async (g) => {
          const members = await get<string[]>(
            `google/group/${g.id}`,
            { q: '.id' },
          )
          return { ...g, members }
        }),
      )

      return new Response(JSON.stringify(teams), {
        headers: {
          'Cache-Control': 'max-age=3600', // 1 hour
          'Content-Type': 'application/json',
        },
      })
    },
    output: ARR(TeamDef, 'List of teams'),
    description: 'Get all teams',
  }),
  'GET/api/team': route({
    authorize: withUserSession,
    fn: async (_ctx, { id }) => {
      if (isLocal) return { id: 'local', name: 'Local', members: [] }
      const group = await getOne<{ name: string }>('google/group', id)
      if (!group) throw new respond.NotFoundError({ message: 'Team not found' })

      const members = await get<{ id: string; email: string }[]>(
        `google/group/${id}`,
        { q: '{ id: .id, email: .email }' },
      )

      const enrichedMembers = await Promise.all(
        members.map(async (m) => {
          const name = await getUserName(m.id)
          const admin = AdminsCollection.get(m.id)
          return {
            email: m.email,
            id: m.id,
            name,
            isAdmin: !!admin,
          }
        }),
      )

      return new Response(
        JSON.stringify({
          id,
          name: group.name,
          members: enrichedMembers,
        }),
        {
          headers: {
            'Cache-Control': 'max-age=3600', // 1 hour
            'Content-Type': 'application/json',
          },
        },
      )
    },
    input: OBJ({ id: STR('The ID of the team') }),
    output: TeamDetailDef,
    description: 'Get a team by ID',
  }),
  'GET/api/projects': route({
    authorize: withUserSession,
    fn: () => ProjectsCollection.values().toArray(),
    output: ARR(projectOutput, 'List of projects'),
    description: 'Get all projects',
  }),
  'POST/api/project': route({
    authorize: withAdminSession,
    fn: (_ctx, project) => {
      log.info('project-created', { slug: project.slug, name: project.name })
      return ProjectsCollection.insert(project)
    },
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
      if (!project) {
        throw new respond.NotFoundError({ message: 'Project not found' })
      }
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
      if (!project) {
        throw new respond.NotFoundError({ message: 'Project not found' })
      }
      ProjectsCollection.delete(slug)
      log.info('project-deleted', { slug })
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
        throw new respond.NotFoundError({ message: 'Deployments not found' })
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
    fn: async (_ctx, { url }) => {
      const dep = DeploymentsCollection.get(url)
      if (!dep) {
        throw new respond.NotFoundError({ message: 'Deployment not found' })
      }
      const { tokenSalt, ...deployment } = dep
      const token = await encryptMessage(
        JSON.stringify({ url: deployment.url, tokenSalt }),
      )
      return { ...deployment, token }
    },
    input: OBJ({ url: STR('Deployment URL') }),
    output: deploymentOutput,
    description: 'Get a deployment by ID',
  }),
  'POST/api/deployment': route({
    authorize: withAdminSession,
    fn: async (_ctx, input) => {
      const tokenSalt = performance.now().toString()
      const { tokenSalt: _, ...deployment } = await DeploymentsCollection
        .insert({ ...input, tokenSalt })
      log.info('deployment-created', {
        url: deployment.url,
        projectId: deployment.projectId,
      })
      const token = await encryptMessage(
        JSON.stringify({ url: deployment.url, tokenSalt }),
      )
      return { ...deployment, token }
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
      log.info('deployment-updated', { url: input.url })
      const token = await encryptMessage(
        JSON.stringify({ url: deployment.url, tokenSalt }),
      )
      return { ...deployment, token }
    },
    input: DeploymentDef,
    output: deploymentOutput,
    description: 'Update a deployment by ID',
  }),
  'POST/api/deployment/token/regenerate': route({
    authorize: withAdminSession,
    fn: async (_ctx, { url }) => {
      const dep = DeploymentsCollection.get(url)
      if (!dep) {
        throw new respond.NotFoundError({ message: 'Deployment not found' })
      }
      const tokenSalt = performance.now().toString()
      log.info('deployment-token-regenerated', { url })

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
      if (!dep) {
        throw new respond.NotFoundError({ message: 'Deployment not found' })
      }
      if (!dep.databaseEnabled) {
        throw new respond.BadRequestError({
          message: 'Database not enabled for deployment',
        })
      }
      const schema = DatabaseSchemasCollection.get(url)
      if (!schema) {
        throw new respond.NotFoundError({ message: 'Schema not cached yet' })
      }
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
          isPrimaryKey: optional(BOOL('Is primary key')),
          relation: optional(OBJ({
            table: STR('Target table'),
            column: STR('Target column'),
            type: LIST(['enum', 'table'], 'Relation type'),
          })),
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
      if (!dep) {
        throw new respond.NotFoundError({ message: 'Deployment not found' })
      }
      await DeploymentsCollection.delete(input)
      log.info('deployment-deleted', { url: input })
      return respond.NoContent()
    },
    input: STR(),
    description: 'Delete a deployment',
  }),
  'POST/api/logs': route({
    authorize: withDeploymentSession,
    fn: (ctx, logs) => {
      if (!ctx.session.url) {
        log.error('deployment-session-missing-url', {
          userId: ctx.session.url,
        })
        throw new respond.InternalServerErrorError({
          message: 'Deployment URL missing from session',
        })
      }
      const count = Array.isArray(logs) ? logs.length : 1
      log.debug('logs-ingested', { deployment: ctx.session.url, count })
      return insertLogs(ctx.session.url, logs)
    },
    input: LogsInputSchema,
    description: 'Insert logs into ClickHouse NB: a Bearer token is required',
  }),
  'POST/api/deployment/logs': route({
    authorize: withUserSession,
    fn: async (ctx, params) => {
      const deployment = DeploymentsCollection.get(params.deployment)
      if (!deployment) {
        throw new respond.NotFoundError({ message: 'Deployment not found' })
      }
      if (!deployment.logsEnabled) {
        throw new respond.BadRequestError({
          message: 'Logging not enabled for deployment',
        })
      }
      const project = ProjectsCollection.get(deployment.projectId)
      if (!project) {
        throw new respond.NotFoundError({ message: 'Project not found' })
      }
      if (!project.isPublic && !ctx.session.isAdmin) {
        if (!(await userInTeam(project.teamId, ctx.session.email))) {
          throw new respond.ForbiddenError({
            message: 'Access to project logs denied',
          })
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
    fn: async (ctx, { deployment, table, ...input }) => {
      const dep = await withDeploymentTableAccess(ctx, deployment)

      const schema = DatabaseSchemasCollection.get(deployment)
      if (!schema) {
        throw new respond.NotFoundError({ message: 'Schema not cached yet' })
      }
      const tableDef = schema.tables.find((t) => t.table === table)
      if (!tableDef) {
        throw new respond.NotFoundError({
          message: 'Table not found in schema',
        })
      }

      try {
        const columnsMap = new Map(tableDef.columns.map((c) => [c.name, c]))
        return await fetchTablesData(
          { ...input, deployment: dep, table },
          columnsMap,
        )
      } catch (err) {
        log.error('fetchTablesData-error', { stack: (err as Error)?.stack })
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
  'POST/api/deployment/table/insert': route({
    authorize: withUserSession,
    fn: async (ctx, { deployment, table, data }) => {
      const dep = await withDeploymentTableAccess(ctx, deployment)
      log.info('table-row-inserted', { deployment, table })
      return insertTableData(dep, table, data)
    },
    input: OBJ({
      deployment: STR("The deployment's URL"),
      table: STR('The table name'),
      data: OBJ({}, 'The row data to insert'),
    }),
    output: OBJ({}, 'The result of the insert'),
  }),
  'POST/api/deployment/table/update': route({
    authorize: withUserSession,
    fn: async (ctx, { deployment, table, pk, data }) => {
      const dep = await withDeploymentTableAccess(ctx, deployment)
      log.info('table-row-updated', { deployment, table, pkKey: pk.key })
      return updateTableData(dep, table, pk, data)
    },
    input: OBJ({
      deployment: STR("The deployment's URL"),
      table: STR('The table name'),
      pk: OBJ({
        key: STR('The primary key column name'),
        value: UNION(
          STR('The primary key value'),
          NUM('The primary key value'),
        ),
      }),
      data: OBJ({}, 'The row data to update'),
    }),
    output: OBJ({}, 'The result of the update'),
  }),
  'GET/api/deployment/query': route({
    authorize: withUserSession,
    fn: async (ctx, { deployment, sql }) => {
      const { sqlEndpoint, sqlToken } = await withDeploymentTableAccess(
        ctx,
        deployment,
      )
      if (!sqlEndpoint || !sqlToken) {
        throw new respond.BadRequestError({
          message: 'SQL endpoint or token not configured for deployment',
        })
      }

      try {
        const startTime = performance.now()
        const data = await runSQL<Record<string, unknown>[]>(
          sqlEndpoint,
          sqlToken,
          sql,
        )
        const duration = (performance.now() - startTime) / 1000
        log.info('sql-query-executed', { deployment, duration })
        return { duration, rows: data }
      } catch (error) {
        if (error instanceof SQLQueryError) {
          const { type, sqlMessage } = error
          log.error('sql-query-failed', { deployment, type, sqlMessage })
          throw new respond.BadRequestError({
            type,
            message: sqlMessage ||
              `SQL query error: ${type || 'Unknown error'}`,
          })
        }
        log.error('sql-query-unexpected-error', {
          deployment,
          error: error instanceof Error ? error.message : String(error),
        })
        throw new respond.InternalServerErrorError({
          message: error instanceof Error ? error.message : 'Unexpected error',
        })
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
  'GET/api/deployment/metrics-sql': route({
    authorize: withUserSession,
    fn: async (ctx, { deployment }) => {
      const { sqlEndpoint, sqlToken } = await withDeploymentTableAccess(
        ctx,
        deployment,
      )
      if (!sqlEndpoint || !sqlToken) {
        throw new respond.BadRequestError({
          message: 'SQL endpoint or token not configured for deployment',
        })
      }

      try {
        return await fetch(`${sqlEndpoint}/metrics`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${sqlToken}` },
        })
      } catch (err) {
        throw new respond.InternalServerErrorError({
          message: err instanceof Error
            ? err.message
            : 'Failed to fetch SQL metrics',
        })
      }
    },
    input: OBJ({ deployment: STR("The deployment's URL") }),
    output: ARR(MetricSchema, 'Collected query metrics'),
    description: 'Get SQL metrics from the deployment',
  }),
  'GET/api/deployment/doc': route({
    authorize: withUserSession,
    fn: async (_ctx, { deployment }) => {
      const dep = DeploymentsCollection.get(deployment)
      if (!dep) {
        throw new respond.NotFoundError({ message: 'Deployment not found' })
      }
      log.info('fetching-api-doc', {
        url: dep.url,
      })
      try {
        const urlStr = dep.url.startsWith('http')
          ? dep.url
          : `${isLocal ? 'http' : 'https'}://${dep.url}`
        return await fetchJson(`${urlStr}/api/doc`, {
          method: 'GET',
        })
      } catch (err) {
        log.error('fetch-api-doc-error', { error: err })
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new respond.InternalServerErrorError({
          message: `Failed to fetch API documentation: ${message}`,
          error: err,
        })
      }
    },
    input: OBJ({
      deployment: STR("The deployment's URL"),
    }),
    output: apiDocOutputDef,
    description: 'Get API documentation from the deployment',
  }),
  'POST/api/deployment/fix-query': route({
    authorize: withUserSession,
    fn: async (ctx, { id, deployment, metric, forceRefresh }) => {
      await withDeploymentTableAccess(ctx, deployment)
      const schema = DatabaseSchemasCollection.get(deployment)
      try {
        const analysis = await analyzeQueryWithAI(
          deployment,
          metric,
          schema,
          !!forceRefresh,
        )
        return { id, analysis }
      } catch (err) {
        log.error('fix-query-failed', {
          deployment,
          metricId: id,
          error: err instanceof Error ? err.message : String(err),
        })
        throw new respond.InternalServerErrorError({
          message: err instanceof Error ? err.message : String(err),
        })
      }
    },
    input: OBJ({
      id: STR('The metric ID'),
      deployment: STR("The deployment's URL"),
      metric: MetricSchema,
      forceRefresh: optional(BOOL('Force bypass of server-side cache')),
    }),
    output: OBJ({
      id: STR('The metric ID'),
      analysis: STR('AI-generated markdown analysis of the query'),
    }),
    description:
      'Analyze a SQL query metric with Gemini AI and suggest optimizations',
  }),
} as const

export type RouteDefinitions = typeof defs
export const routeHandler = makeRouter(defs, { log })
