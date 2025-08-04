import { Asserted, makeRouter, route } from '/api/lib/router.ts'
import type { RequestContext } from '/api/lib/context.ts'
import { handleGoogleCallback, initiateGoogleAuth } from './auth.ts'
import { ProjectDef, ProjectsStore, User, UserDef } from './schema.ts'
import { ARR, LIST, NUM, OBJ, optional, STR } from './lib/validator.ts'
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
  'GET/api/projects': route({
    authorize: withUserSession,
    fn: (_ctx: RequestContext) => {
      const projects = ProjectsStore.values().map((project) => ({
        slug: project.slug,
        name: project.name,
        logging: project.logging
          ? {
            provider: project.logging.provider,
            config: {
              sourceId: project.logging.config.sourceId,
            },
          }
          : undefined,
        env: project.env,
        createdAt: project.createdAt,
      })).toArray()
      return projects
    },
    output: ARR(
      OBJ({
        slug: STR('The unique slug of the project'),
        name: STR('The name of the project'),
        logging: optional(OBJ({
          provider: STR('The logging provider'),
          config: OBJ({
            sourceId: STR('The BetterStack project ID'),
          }),
        })),
        env: LIST(['dev', 'prod'], 'The environment of the project'),
        createdAt: NUM('The creation date of the project'),
      }),
      'List of projects',
    ),
    description: 'Get the list of projects',
  }),
  // 'POST/api/projects': route({
  //   authorize: withAdminSession,
  //   fn: async (_ctx: RequestContext, project) => {
  //       const newProject = {
  //         ...project,
  //         createdAt: Date.now(),
  //         logging: undefined,
  //         endpoints: undefined,
  //         security: undefined,
  //       }
  //       await ProjectsStore.insert(newProject)
  //       return newProject
  //   },
  //   input: OBJ({
  //     slug: STR('The unique slug of the project'),
  //     name: STR('The name of the project'),
  //     platformUrl: STR('The project platform URL'),
  //     env: LIST(['dev', 'prod'], 'The environment of the project'),
  //   }),
  //   output: OBJ({
  //     slug: STR('The unique slug of the project'),
  //     name: STR('The name of the project'),
  //     logging: optional(OBJ({
  //       provider: STR('The logging provider'),
  //       config: OBJ({
  //         sourceId: STR('The BetterStack project ID'),
  //       }),
  //     })),
  //     env: LIST(['dev', 'prod'], 'The environment of the project'),
  //     createdAt: NUM('The creation date of the project'),
  //   }),
  //   description: 'Create a new project',
  // }),
  'GET/api/projects/:id': route({
    authorize: withUserSession,
    fn: (_ctx: RequestContext, { id }) => {
      const project = ProjectsStore.get(id)
      if (!project) {
        throw respond.NotFound({
          message: `Project with ID ${id} not found`,
        })
      }
      const isAdmin = _ctx.user?.isAdmin || false
      return {
        slug: project.slug,
        name: project.name,
        deployementUrl: project.deployementUrl,
        logging: project.logging
          ? {
            provider: project.logging.provider,
            config: {
              apiToken: isAdmin ? project.logging.config.apiToken : '',
              sourceId: project.logging.config.sourceId,
            },
          }
          : undefined,
        endpoints: isAdmin ? project.endpoints : undefined,
        security: isAdmin ? project.security : undefined,
        env: project.env,
        createdAt: project.createdAt,
      }
    },
    input: OBJ({ id: STR('The ID of the project') }),
    output: ProjectDef,
    description: 'Get a specific project by ID',
  }),
  // 'PUT/api/projects/:id': route({
  //   authorize: withAdminSession,
  //   fn: async (_ctx: RequestContext, { id }, project) => {
  //     const existingProject = ProjectsStore.get(id)
  //     if (!existingProject) throw respond.NotFound({
  //       message: `Project with ID ${id} not found`,
  //     })
  //     const updatedProject = {
  //       ...existingProject,
  //       ...project,
  //       createdAt: existingProject.createdAt, // Preserve creation date
  //     }
  //     await ProjectsStore.update(id, updatedProject)
  //     return updatedProject
  //   },
  //   input: OBJ({
  //     slug: STR('The slug of the project'),
  //     name: optional(STR('The name of the project')),
  //     deployementUrl: optional(STR('The project platform URL')),
  //     logging: optional(OBJ({
  //       provider: optional(STR('The logging provider')),
  //       config: OBJ({
  //         apiToken: optional(STR('The API token for BetterStack')),
  //         sourceId: optional(STR('The source ID for BetterStack')),
  //       }),
  //     })),
  //     // endpoints: optional(PlatformEndpointsDef),
  //     // security: optional(SecurityConfigDef),
  //     env: optional(LIST(['dev', 'prod'], 'The environment of the project')),
  //   }),
  //   output: ProjectDef,
  //   description: 'Update a specific project by ID',
  // }),
} as const

export type RouteDefinitions = typeof defs
export const routeHandler = makeRouter(defs).handle
