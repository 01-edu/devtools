import { STATUS_CODE, STATUS_TEXT } from 'jsr:@std/http/status'

const defaultHeaderEntries: [string, string][] = [
  ['content-type', 'application/json'],
]

const defaultHeaders = new Headers(defaultHeaderEntries)

const json = (data?: unknown, init?: ResponseInit) => {
  if (data == null) return new Response(null, init)
  if (!init) {
    init = { headers: defaultHeaders }
  } else if (!init.headers) {
    init.headers = defaultHeaders
  } else {
    if (!(init.headers instanceof Headers)) {
      init.headers = new Headers(init.headers)
    }
    const h = init.headers as Headers
    for (const entry of defaultHeaderEntries) {
      h.set(entry[0], entry[1])
    }
  }

  return new Response(JSON.stringify(data), init)
}

class ResponseError extends Error {
  public response: Response

  constructor(message: string, response: Response) {
    super(message)
    this.name = 'ResponseError'
    this.response = response
  }
}

type StatusCodeWithoutBody =
  | 'Continue'
  | 'SwitchingProtocols'
  | 'Processing'
  | 'EarlyHints'
  | 'NoContent'
  | 'ResetContent'
  | 'NotModified'

const withoutBody = new Set([
  100, // Continue
  101, // SwitchingProtocols
  102, // Processing
  103, // EarlyHints
  204, // NoContent
  205, // ResetContent
  304, // NotModified
])

type StatusNotErrors =
  | 'OK'
  | 'Created'
  | 'Accepted'
  | 'NonAuthoritativeInfo'
  | 'NoContent'
  | 'ResetContent'
  | 'PartialContent'
  | 'MultiStatus'
  | 'AlreadyReported'
  | 'IMUsed'
  | 'MultipleChoices'
  | 'MovedPermanently'
  | 'Found'
  | 'SeeOther'
  | 'NotModified'
  | 'UseProxy'
  | 'TemporaryRedirect'
  | 'PermanentRedirect'

const notErrors = new Set([
  200, // OK
  201, // Created
  202, // Accepted
  203, // NonAuthoritativeInfo
  204, // NoContent
  205, // ResetContent
  206, // PartialContent
  207, // MultiStatus
  208, // AlreadyReported
  226, // IMUsed
  300, // MultipleChoices
  301, // MovedPermanently
  302, // Found
  303, // SeeOther
  304, // NotModified
  305, // UseProxy
  307, // TemporaryRedirect
  308, // PermanentRedirect
])

type ErrorStatus = Exclude<
  Exclude<keyof typeof STATUS_CODE, StatusCodeWithoutBody>,
  StatusNotErrors
>

export const respond = Object.fromEntries([
  ...Object.entries(STATUS_CODE).map(([key, status]) => {
    const statusText = STATUS_TEXT[status]
    const defaultData = new TextEncoder().encode(
      JSON.stringify({ message: statusText }) + '\n',
    )

    const makeResponse = withoutBody.has(status)
      ? (headers?: HeadersInit) =>
        headers === undefined
          ? json(null, { headers: defaultHeaders, status, statusText })
          : json(null, { headers, status, statusText })
      : (data?: unknown, headers?: HeadersInit) =>
        data === undefined
          ? new Response(defaultData, {
            headers: defaultHeaders,
            status,
            statusText,
          })
          : json(data, { headers, status, statusText })

    return [key, makeResponse]
  }),

  ...Object.entries(STATUS_CODE)
    .filter(([_, status]) => !withoutBody.has(status) && !notErrors.has(status))
    .map(([key, status]) => {
      const statusText = STATUS_TEXT[status]
      const name = `${key}Error`
      return [
        name,
        class extends ResponseError {
          constructor(data?: unknown, headers?: HeadersInit) {
            super(statusText, respond[key as ErrorStatus](data, headers))
            this.name = name
          }
        },
      ]
    }),
  ['ResponseError', ResponseError],
]) as (
  & {
    [k in Exclude<keyof typeof STATUS_CODE, StatusCodeWithoutBody>]: (
      data?: unknown,
      headers?: HeadersInit,
    ) => Response
  }
  & {
    [k in Extract<keyof typeof STATUS_CODE, StatusCodeWithoutBody>]: (
      headers?: HeadersInit,
    ) => Response
  }
  & {
    [
      k in `${Exclude<
        Exclude<keyof typeof STATUS_CODE, StatusCodeWithoutBody>,
        StatusNotErrors
      >}Error`
    ]: new (data?: unknown, headers?: HeadersInit) => ResponseError
  }
  & { ResponseError: typeof ResponseError }
)
