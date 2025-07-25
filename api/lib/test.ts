import {
  assertEquals as eq,
  assertRejects as rejects,
  assertThrows as throws,
} from 'jsr:@std/assert'

import { now } from '/api/lib/time.ts'
import { debug } from '/api/lib/log.ts'
import { APP_ENV } from '/api/lib/env.ts'
import { type RequestContext, requestContext } from '/api/lib/context.ts'

// short aliases for most used asserts
export { eq, rejects, throws }

// test wrapper that sets a context
type TestStep = Deno.TestContext['step']
export const test = (
  name: string,
  handler: TestStep,
  opts?: Omit<Deno.TestDefinition, 'fn' | 'name'>,
) => {
  if (APP_ENV !== 'test') return
  const ignore = APP_ENV !== 'test' || opts?.ignore
  const url = new URL(
    Error('').stack!.split('\n')[1].match(/\([^)]+\)/)![0].slice(1, -1),
  )
  const ctx = {
    req: new Request(url),
    url,
    cookies: {},
    trace: now(),
  } as RequestContext
  const fn = async (t: Deno.TestContext) => {
    debug('test-start', { name, origin: t.origin })
    await handler(async (...args) => {
      await requestContext.run({ ...ctx, span: now() }, async () => {
        const stepName = args[0]?.name || args[0]
        debug('step-start', { name: stepName, origin: t.origin })
        const result = await t.step(
          ...args as unknown as Parameters<typeof t.step>,
        )
        debug('step-end', { name: stepName, origin: t.origin })
        return result
      })
    })
  }
  return requestContext.run(ctx, () => Deno.test({ ...opts, name, fn, ignore }))
}
