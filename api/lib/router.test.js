import { eq, test } from '/api/lib/test.ts'
import { makeContext } from '/api/lib/context.ts'
import { makeRouter } from '/api/lib/router.ts'
import { ARR, BOOL, NUM, OBJ, optional, STR } from '/api/lib/validator.ts'
import { startTime } from '/api/lib/time.ts'

const router = (route) => makeRouter(route).handle
const makeContextReq = (path, init) => {
  const url = new URL(path, 'http://localhost')
  return makeContext(url, { req: new Request(url, init) })
}

test('Router - Basic HTTP Methods', async (step) => {
  await step('GET request without params', async () => {
    const r = router({
      'GET/health': {
        fn: () => ({ status: 'ok' }),
        output: OBJ({ status: STR() }),
      },
    })
    const response = await r(makeContext('/health'))
    eq(response.status, 200)

    const data = await response.json()
    eq(data, { status: 'ok' })
  })

  await step('GET request with query params', async () => {
    const r = router({
      'GET/users': {
        fn: (_ctx, input) => ({ id: input.id, name: 'John' }),
        input: OBJ({ id: STR() }),
        output: OBJ({ id: STR(), name: STR() }),
      },
    })
    const response = await r(makeContext('/users?id=123'))
    eq(response.status, 200)

    const data = await response.json()
    eq(data, { id: '123', name: 'John' })
  })

  await step('POST request with body', async () => {
    const r = router({
      'POST/users': {
        fn: (_ctx, input) => ({ ...input, id: 1 }),
        input: OBJ({ name: STR(), age: NUM() }),
        output: OBJ({ id: NUM(), name: STR(), age: NUM() }),
      },
    })
    const response = await r(
      makeContextReq('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 30 }),
      }),
    )
    const data = await response.json()

    eq(response.status, 200)
    eq(data, { id: 1, name: 'John', age: 30 })
  })

  await step('DELETE request with params', async () => {
    const r = router({
      'DELETE/users': {
        fn: (_ctx, input) => ({ deleted: input.id }),
        input: OBJ({ id: NUM() }),
        output: OBJ({ deleted: NUM() }),
      },
    })
    const response = await r(
      makeContextReq('/users', {
        method: 'DELETE',
        body: JSON.stringify({ id: 123 }),
      }),
    )
    eq(response.status, 200)

    const data = await response.json()
    eq(data, { deleted: 123 })
  })
})

test('Router - Complex Data Structures', async (step) => {
  await step('Nested objects and arrays', async () => {
    const r = router({
      'POST/articles': {
        fn: (_ctx, input) => ({ id: 1, ...input, created: true }),
        input: OBJ({
          title: STR(),
          content: STR(),
          tags: ARR(STR()),
          author: OBJ({ name: STR(), email: STR() }),
        }),
        output: OBJ({
          id: NUM(),
          title: STR(),
          content: STR(),
          tags: ARR(STR()),
          author: OBJ({ name: STR(), email: STR() }),
          created: BOOL(),
        }),
      },
    })

    const response = await r(
      makeContextReq('/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Article',
          content: 'Content here',
          tags: ['test', 'article'],
          author: {
            name: 'John',
            email: 'john@test.com',
          },
        }),
      }),
    )
    const data = await response.json()

    eq(response.status, 200)
    eq(data, {
      created: true,
      id: 1,
      title: 'Test Article',
      content: 'Content here',
      tags: ['test', 'article'],
      author: {
        name: 'John',
        email: 'john@test.com',
      },
    })
  })

  await step('Optional fields handling', async () => {
    const r = router({
      'POST/posts': {
        fn: (_ctx, input) => ({ id: 1, ...input }),
        input: OBJ({
          title: STR(),
          content: STR(),
          tags: optional(ARR(STR())),
          draft: optional(BOOL()),
        }),
        output: OBJ({
          id: NUM(),
          title: STR(),
          content: STR(),
          tags: optional(ARR(STR())),
          draft: optional(BOOL()),
        }),
      },
    })

    const response = await r(
      makeContextReq('/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Post', content: 'Content here' }),
      }),
    )

    eq(response.status, 200)

    const data = await response.json()
    eq(data.title, 'Test Post')
    eq(data.tags, undefined)
  })
})

test('Router - Error Handling', async (step) => {
  await step('404 - Route not found', async () => {
    const r = router({
      'GET/test': {
        fn: () => ({ ok: true }),
        input: OBJ({}),
        output: OBJ({ ok: BOOL() }),
      },
    })
    const response = await r(makeContext('/nonexistent'))
    eq(response.status, 404)
  })

  await step('400 - Invalid input type', async () => {
    const r = router({
      'POST/users': {
        fn: (_ctx, input) => input,
        input: OBJ({ age: NUM() }),
        output: OBJ({ age: NUM() }),
      },
    })
    const response = await r(
      makeContextReq('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ age: 'not a number' }),
      }),
    )
    eq(response.status, 400)
  })

  await step('400 - Missing required field', async () => {
    const r = router({
      'POST/users': {
        fn: (_ctx, input) => input,
        input: OBJ({ name: STR(), age: NUM() }),
        output: OBJ({ name: STR(), age: NUM() }),
      },
    })
    const response = await r(
      makeContextReq('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John' }), // missing age
      }),
    )
    eq(response.status, 400)
  })

  await step('400 - Invalid JSON body', async () => {
    const r = router({
      'POST/users': {
        fn: (_ctx, input) => input,
        input: OBJ({ name: STR() }),
        output: OBJ({ name: STR() }),
      },
    })
    const response = await r(
      makeContextReq('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      }),
    )
    eq(response.status, 400)
  })
})

test('Router - Context should be passed to handler', async (step) => {
  await step('should handle custom headers', async () => {
    const r = router({
      'GET/auth': {
        fn: (ctx) => ({ trace: ctx.trace }),
        input: OBJ({}),
        output: OBJ({ trace: NUM() }),
      },
    })
    const response = await r(makeContext('/auth'))
    eq(response.status, 200)

    const data = await response.json()
    eq(data, { trace: startTime })
  })
})

// TODO:
// add tests for no ouput
// add tests for no input and no output
// add test that failing handler error should be passed untouched
// add check that GET can only have OBJ({ [k]: STR() }) as input
// add stringify / parse optional methods to have payload formatting and validation
//  ex: handle Date type, numbers in GET requests etc...