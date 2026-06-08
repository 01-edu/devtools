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

type Params = Record<string, unknown>

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
    props?: Params,
  ) => {
    const ctx = getContext()
    const attributes =
      props && typeof props === 'object' && !Array.isArray(props)
        ? props
        : {}

    batch.push({
      timestamp: Date.now(),
      trace_id: ctx?.trace ?? Date.now() / 1000,
      span_id: ctx?.span ?? ctx?.trace ?? Date.now() / 1000,
      severity_number: severityMap[level],
      event_name: event,
      attributes,
    })

    const c = console[level] || console.info
    c(event, props)

    if (batch.length >= 50) flush()
  }

  return Object.assign(log, {
    error: (e: string, p?: Params) => log('error', e, p),
    debug: (e: string, p?: Params) => log('debug', e, p),
    warn: (e: string, p?: Params) => log('warn', e, p),
    info: (e: string, p?: Params) => log('info', e, p),
  })
}

export const log = createLogger('devtools')
