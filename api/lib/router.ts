import type { Def } from '/api/lib/validator.ts'
import { respond } from '/api/lib/response.ts'
import type { RequestContext as Ctx } from '/api/lib/context.ts'

// Supported HTTP methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
type Path = `/${string}`
export type RoutePattern = `${HttpMethod}${Path}`

type RequestHandler = (ctx: Ctx) => Awaitable<Response>
export type Awaitable<T> = Promise<T> | T
export type Asserted<T extends Def> = ReturnType<T['assert']>
type Nullish = null | undefined | void
type Respond<T> = Awaitable<T | Response>
type HandlerFn<TInput, TOutput> = [TInput] extends [Def]
  ? [TOutput] extends [Def]
    ? (ctx: Ctx, input: Asserted<TInput>) => Respond<Asserted<TOutput>>
  : (ctx: Ctx, input: Asserted<TInput>) => Respond<Nullish>
  : [TOutput] extends [Def] ? (ctx: Ctx) => Respond<Asserted<TOutput>>
  : (ctx: Ctx) => Respond<Nullish>

type AuthorizeHandler<TInput> = [TInput] extends [Def]
  ? (ctx: Ctx, input: Asserted<TInput>) => Awaitable<void>
  : (ctx: Ctx) => Awaitable<void>

export type Handler<TInput, TOutput> = {
  authorize?: AuthorizeHandler<TInput>
  fn: HandlerFn<TInput, TOutput>
  description?: string
  input?: TInput
  output?: TOutput
}

export const route = <TInput, TOutput>(
  h: TInput extends Def ? TOutput extends Def ? Handler<TInput, TOutput>
    : Handler<TInput, undefined>
    : TOutput extends Def ? Handler<undefined, TOutput>
    : Handler<undefined, undefined>,
) => h

export type Router<T extends RoutePattern> = {
  [P in T]: Handler<Def | undefined, Def | undefined>
}

const getPayloadParams = (ctx: Ctx) => Object.fromEntries(ctx.url.searchParams)
const getPayloadBody = async (ctx: Ctx) => {
  try {
    return await ctx.req.json()
  } catch {
    return {}
  }
}

type Route = Record<HttpMethod, RequestHandler>
type SimpleHandler = (ctx: Ctx, payload: unknown) => Respond<Nullish>

export const makeRouter = <T extends RoutePattern>(defs: Router<T>) => {
  const routeMaps: Record<string, Route> = Object.create(null)

  for (const key in defs) {
    const slashIndex = key.indexOf('/')
    const method = key.slice(0, slashIndex) as HttpMethod
    const url = key.slice(slashIndex)
    if (!routeMaps[url]) {
      routeMaps[url] = Object.create(null) as Route
      routeMaps[`${url}/`] = routeMaps[url]
    }
    const { fn, input, authorize } = defs[key] as Handler<Def, Def>
    const simpleHandler = async <T extends Def>(
      ctx: Ctx,
      payload?: Asserted<T>,
    ) => {
      try {
        await authorize?.(ctx, payload as Asserted<T>)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unauthorized'
        return respond.Unauthorized({ message })
      }
      const result = await (fn as SimpleHandler)(ctx, payload)
      if (result == null) return respond.NoContent()
      return result instanceof Response ? result : respond.OK(result)
    }
    if (input) {
      const getPayload = method === 'GET' ? getPayloadParams : getPayloadBody
      const assert = input.assert
      const report = input.report || (() => [`Expect a ${input?.type}`])
      routeMaps[url][method] = async (ctx: Ctx) => {
        const payload = await getPayload(ctx)
        let asserted
        try {
          asserted = assert(payload)
        } catch {
          const message = 'Input validation failed'
          const failures = report(payload)
          return respond.BadRequest({ message, failures })
        }
        try {
          await authorize?.(ctx, payload)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unauthorized'
          return respond.Unauthorized({ message })
        }
        return simpleHandler(ctx, asserted)
      }
    } else {
      routeMaps[url][method] = simpleHandler
    }
  }

  const handle = (ctx: Ctx) => {
    const route = routeMaps[ctx.url.pathname]
    if (!route) return respond.NotFound()

    const handler = route[ctx.req.method as HttpMethod]
    if (!handler) return respond.MethodNotAllowed()

    return handler(ctx)
  }

  return { handle }
}
