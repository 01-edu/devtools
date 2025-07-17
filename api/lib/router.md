# TypeScript Router

A type-safe HTTP router with built-in validation and API documentation
generation.

## Features

- 🔒 Type-safe request/response handling
- ✅ Built-in input/output validation
- 📝 Automatic API documentation generation
- 🎯 Support for all standard HTTP methods
- 🔄 Async request handling
- 🍪 Cookie and session management
- ⚡ High-precision request timing

## Basic Usage

```typescript
import { NUM, OBJ, router, STR } from '@your-package/router'
// Define your routes
const api = router({
  'GET/users': {
    fn: (input, ctx) => ({ id: input.id, name: 'John' }),
    description: 'Get user by ID',
    input: OBJ({ id: NUM('User ID') }),
    output: OBJ({
      id: NUM('User ID'),
      name: STR('User name'),
    }),
  },
})
// Use with your server
server.handle('/api/', api)
```

## Validation

The router includes a powerful validation system:

```typescript
// Define a schema
const UserSchema = OBJ({
  name: STR("User's full name"),
  age: NUM("User's age"),
  tags: ARR(STR('Tag name'), 'User tags'),
  settings: optional(
    OBJ({
      theme: STR('UI theme'),
      notifications: BOOL('Notification preferences'),
    }),
  ),
})
// Use in route definition
const api = router({
  'POST/users': {
    fn: async (input) => {
      // input is fully typed and validated
      return { id: 1, ...input }
    },
    input: UserSchema,
    output: OBJ({
      id: NUM('User ID'),
      ...UserSchema.properties,
    }),
  },
})
```

## API Documentation

The router automatically generates interactive HTML documentation for your API:

```typescript
import { generateApiDocs } from '@your-package/router'
const docs = generateApiDocs({
  'POST/users': {
    fn: async (input) => {
      // input is fully typed and validated
      return { id: 1, ...input }
    },
    input: UserSchema,
    output: OBJ({
      id: NUM('User ID'),
      ...UserSchema.properties,
    }),
  },
})
server.handle('/docs', docs)
```

The documentation includes:

- Method and path information
- Request/response schemas
- Interactive examples
- Search and filtering
- Dark/light mode support

## Error Handling

The router provides built-in error handling:

```typescript
// Validation errors return 400
// Example response:
{
error: "Validation Error",
failures: [
{
path: ["age"],
type: "number",
value: "not a number"
}
]
}
// Not found returns 404
{
error: "Not Found"
}
// Method not allowed returns 405
{
error: "Method Not Allowed"
}
```

## Context and Sessions

Each request handler receives a context object:

```typescript
interface Context {
  readonly session: Record<string, string> // Cookie data
  readonly trace: number // Request trace ID
  readonly span?: number // Request timing
}
const api = router({
  'GET/profile': {
    fn: (input, ctx) => {
      // Access session data
      const userId = ctx.session.userId
      // Use timing information
      const requestTime = ctx.span - ctx.trace
      return { userId, requestTime }
    },
    input: OBJ({}),
    output: OBJ({
      userId: STR(),
      requestTime: NUM(),
    }),
  },
})
```
