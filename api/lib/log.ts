import { APP_ENV } from '/api/lib/env.ts'
import { now, startTime } from '/api/lib/time.ts'
import { getContext } from '/api/lib/context.ts'
import {
  blue,
  brightBlue,
  brightCyan,
  brightGreen,
  brightMagenta,
  brightRed,
  brightYellow,
  cyan,
  gray,
  green,
  magenta,
  red,
  yellow,
} from 'jsr:@std/fmt/colors'

type LogLevel =
  | 'info' // default level
  | 'error'
  | 'warn'
  | 'debug'

type LogFunction = (
  level: LogLevel,
  event: string,
  props?: Record<string, unknown>,
) => void

type BoundLogFunction = (event: string, props?: Record<string, unknown>) => void

interface Log extends LogFunction {
  error: BoundLogFunction
  debug: BoundLogFunction
  warn: BoundLogFunction
  info: BoundLogFunction
}

const levels = {
  debug: { ico: '🐛', color: green },
  info: { ico: 'ℹ️', color: cyan },
  warn: { ico: '⚠️', color: yellow },
  error: { ico: '💥', color: red },
} as const

// set to recursive to not fail if already exists
const logDir = `${Deno.cwd()}/.logs`
await Deno.mkdir(logDir, { recursive: true })

// format: https://jsonlines.org/
// TODO: see if we can aquire a write lock for the file
export const logFilePath = `${logDir}/api_${APP_ENV}${
  APP_ENV === 'prod' ? `_${startTime.toString(36).split('.')[0]}` : ''
}.jsonl`
// when not in prod, we clean logs between boots
const logFile = await Deno.open(logFilePath, {
  append: true,
  ...(APP_ENV === 'prod' ? { createNew: true } : { create: true }),
})
APP_ENV === 'prod' || await logFile.truncate(0).catch(() => {
  // console.log('unable to truncate', { logFilePath })
})
const encoder = new TextEncoder()

function replacer(_key: string, value: unknown) {
  if (value instanceof Error) return value.stack || value.message
  return value
}

const colors = [
  ...[green, yellow, blue, magenta, cyan, brightRed],
  ...[brightGreen, brightYellow, brightBlue, brightMagenta, brightCyan],
]
const colored: Record<string, string> = { 'Object.fetch': cyan('serve') }
const makePrettyTimestamp = (level: LogLevel, event: string) => {
  const at = new Date()
  const hh = String(at.getHours()).padStart(2, '0')
  const mm = String(at.getMinutes()).padStart(2, '0')
  const ss = String(at.getSeconds()).padStart(2, '0')
  const ms = String(at.getMilliseconds()).padStart(2, '0').slice(0, 2)
  const lvl = levels[level]
  return `${gray(`${hh}h${mm}:${ss}.${ms}`)} ${lvl.ico} ${lvl.color(event)}`
}

const bannedTestEvents = new Set(
  ['step-end', 'step-start', 'test-end', 'test-start'],
)

const rootDir =
  import.meta.dirname?.slice(0, -'/lib'.length).replaceAll('\\', '/') || ''
const loggers: Record<typeof APP_ENV, LogFunction> = {
  test: (level, event, props) => {
    const { trace, span, url } = getContext()
    const data = {
      level,
      trace,
      span,
      event,
      props,
      at: now(),
      file: url.pathname,
    }
    logFile.writeSync(encoder.encode(`${JSON.stringify(data, replacer)}\n`))
    if (bannedTestEvents.has(event)) return
    const ev = makePrettyTimestamp(level, event)
    props ? console[level](ev, props) : console[level](ev)
  },
  dev: (level, event, props) => {
    let callChain = ''
    for (const s of Error('').stack!.split('\n').slice(2).reverse()) {
      if (!s.includes(rootDir)) continue
      const fnName = s.split(' ').at(-2)
      if (!fnName || fnName === 'async' || fnName === 'at') continue
      const coloredName = colored[fnName] ||
        (colored[fnName] = colors[Object.keys(colored).length % colors.length](
          fnName,
        ))
      callChain = callChain ? `${callChain}/${coloredName}` : coloredName
    }
    const { trace, span } = getContext()
    const data = { level, trace, span, event, props, at: now() }
    const logStr = JSON.stringify(data, replacer)
    logFile.writeSync(encoder.encode(`${logStr}\n`))
    const bytes = encoder.encode(`data: ${logStr}\r\n\r\n`)
    for (const controller of logListeners) {
      try {
        controller.enqueue(bytes)
      } catch (err) {
        console.error('unable to send log', err)
      }
    }
    const ev = `${makePrettyTimestamp(level, event)} ${callChain}`.trim()
    props ? console[level](ev, props) : console[level](ev)
  },
  prod: (level, event, props) => {
    const { trace, span } = getContext()
    console.log(JSON.stringify({ level, trace, span, event, props, at: now() }))
  },
}

export const log = loggers[APP_ENV] as Log

// Bind is used over wrapping for reducing error stack
log.error = log.bind(null, 'error')
log.debug = log.bind(null, 'debug')
log.warn = log.bind(null, 'warn')
log.info = log.bind(null, 'info')

export const error = log.error
export const debug = log.debug
export const warn = log.warn
export const info = log.info
export const logListeners = new Set<ReadableStreamDefaultController<unknown>>()

// TODO: target betterstack, use open telemetry fields
