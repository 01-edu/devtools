import { makeClient } from '@01edu/api-client'
import type { RouteDefinitions } from '../../api/routes.ts'
export const api = makeClient<RouteDefinitions>()

export type ApiOutput = {
  [K in keyof typeof api]: Awaited<ReturnType<typeof api[K]['fetch']>>
}

export type ApiInput = {
  [K in keyof typeof api]: Awaited<Parameters<typeof api[K]['fetch']>[0]>
}
