import { AsyncLocalStorage } from 'node:async_hooks'
import { startTime } from '/api/lib/time.ts'
import { Asserted } from './router.ts'
import { userDef } from '../schema.ts'

type Readonly<T> = {
  readonly [P in keyof T]:
    // deno-lint-ignore ban-types
    T[P] extends Function ? T[P]
      : T[P] extends object ? Readonly<T[P]>
      : T[P]
}

// Define the route structure with supported methods
// export type Session = { id: number; createdAt: number; userId: number }
export type RequestContext = {
  readonly req: Readonly<Request>
  readonly url: Readonly<URL>
  readonly cookies: Readonly<Record<string, string>>
  readonly user: Readonly<Asserted<typeof userDef>> | undefined
  readonly trace: number
  readonly span: number | undefined
}

// we set default values so we don't have to check everytime if they exists
export const makeContext = (
  urlInit: string | URL,
  extra?: Partial<RequestContext>,
): RequestContext => {
  const url = new URL(urlInit, 'http://locahost')
  const req = new Request(url)
  return {
    trace: startTime,
    cookies: {},
    user: undefined,
    span: undefined,
    url,
    req,
    ...extra,
  }
}

const defaultContext = makeContext('/')
export const requestContext = new AsyncLocalStorage<RequestContext>()
export const getContext = () => requestContext.getStore() || defaultContext
