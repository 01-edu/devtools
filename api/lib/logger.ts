import type { Log } from '@01edu/api/log'
import { getContext } from '@01edu/api/context'
import { insertLogs } from '/api/clickhouse-client.ts'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogFunction = (
  level: LogLevel,
  event: string,
  props?: Record<string, unknown>,
) => void

const severityMap: Record<LogLevel, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
}

const push = (
  serviceName: string,
  level: LogLevel,
  event: string,
  props?: Record<string, unknown>,
) => {
  const ctx = getContext()
  const traceId = ctx?.trace ?? Date.now() / 1000
  const spanId = ctx?.span ?? traceId

  insertLogs(serviceName, {
    timestamp: Date.now(),
    trace_id: traceId,
    span_id: spanId,
    severity_number: severityMap[level],
    event_name: event,
    attributes: props ?? {},
    service_version: undefined,
    service_instance_id: undefined,
  }).catch((err) => {
    console.error('log-insert-failed', {
      error: err instanceof Error ? err.message : String(err),
      event,
      level,
    })
  })
}

export function createLogger(serviceName: string): Log {
  const log: LogFunction = (level, event, props) => {
    const consoleMethod = level === 'error'
      ? console.error
      : level === 'warn'
      ? console.warn
      : level === 'debug'
      ? console.debug
      : console.info
    consoleMethod(event, props)
    push(serviceName, level, event, props)
  }

  return Object.assign(log, {
    error: (event: string, props?: Record<string, unknown>) =>
      log('error', event, props),
    debug: (event: string, props?: Record<string, unknown>) =>
      log('debug', event, props),
    warn: (event: string, props?: Record<string, unknown>) =>
      log('warn', event, props),
    info: (event: string, props?: Record<string, unknown>) =>
      log('info', event, props),
  })
}

export const log = createLogger('devtools')
