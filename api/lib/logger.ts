import type { Log } from '@01edu/api/log'
import { getContext } from '@01edu/api/context'
import { insertLogs } from '/api/clickhouse-client.ts'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const severityMap: Record<LogLevel, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
}

export function createLogger(serviceName: string): Log {
  const batch: Record<string, unknown>[] = []

  const flush = () => {
    if (batch.length === 0) return
    const logs = batch.splice(0, batch.length)
    insertLogs(serviceName, logs as never[]).catch((err) => {
      console.error('flush-failed', err)
    })
  }

  setInterval(flush, 5000)

  const log = (
    level: LogLevel,
    event: string,
    props?: Record<string, unknown>,
  ) => {
    const ctx = getContext()
    batch.push({
      timestamp: Date.now(),
      trace_id: ctx?.trace ?? Date.now() / 1000,
      span_id: ctx?.span ?? ctx?.trace ?? Date.now() / 1000,
      severity_number: severityMap[level],
      event_name: event,
      attributes: props ?? {},
      service_version: null,
      service_instance_id: null,
    })

    const m = level === 'error'
      ? console.error
      : level === 'warn'
      ? console.warn
      : level === 'debug'
      ? console.debug
      : console.info
    m(event, props)

    if (batch.length >= 50) flush()
  }

  return Object.assign(log, {
    error: (e: string, p?: Record<string, unknown>) => log('error', e, p),
    debug: (e: string, p?: Record<string, unknown>) => log('debug', e, p),
    warn: (e: string, p?: Record<string, unknown>) => log('warn', e, p),
    info: (e: string, p?: Record<string, unknown>) => log('info', e, p),
  })
}

export const log = createLogger('devtools')
