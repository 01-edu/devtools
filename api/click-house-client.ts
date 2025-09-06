import { createClient } from 'npm:@clickhouse/client'
import {
  CLICKHOUSE_HOST,
  CLICKHOUSE_PASSWORD,
  CLICKHOUSE_USER,
} from './lib/env.ts'
import { respond } from './lib/response.ts'
import { log } from './lib/log.ts'
import { ARR, NUM, OBJ, optional, STR, UNION } from './lib/validator.ts'
import { Asserted } from './lib/router.ts'

const LogSchema = OBJ({
  timestamp: NUM('The timestamp of the log event'),
  trace_id: NUM('A float64 representation of the trace ID'),
  span_id: optional(NUM('A float64 representation of the span ID')),
  severity_number: NUM('The severity number of the log event'),
  attributes: optional(OBJ({}, 'A map of attributes')),
  event_name: STR('The name of the event'),
  service_version: optional(STR('Service version')),
  service_instance_id: optional(STR('Service instance ID')),
}, 'A log event')
const LogsInputSchema = UNION(
  LogSchema,
  ARR(LogSchema, 'An array of log events'),
)

type Log = Asserted<typeof LogSchema>
type LogsInput = Asserted<typeof LogsInputSchema>

const client = createClient({
  url: CLICKHOUSE_HOST,
  username: CLICKHOUSE_USER,
  password: CLICKHOUSE_PASSWORD,
  compression: {
    request: true,
    response: true,
  },
})

export function float64ToId128(
  { id }: { id: number },
) {
  const id128 = new Uint8Array(8)
  const view = new DataView(id128.buffer)
  view.setFloat64(0, id, false)
  return id128
}

export function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}
const escapeSql = (s: unknown) =>
  String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "''")

async function insertLogs(
  service_name: string,
  data: LogsInput,
) {
  const logsToInsert = Array.isArray(data) ? data : [data]
  if (logsToInsert.length === 0) throw respond.NoContent()

  const rows = logsToInsert.map((log) => {
    const traceHex = bytesToHex(float64ToId128({ id: log.trace_id }))
    const spanHex = bytesToHex(
      float64ToId128({ id: log.span_id ?? log.trace_id }),
    )
    return {
      ...log,
      timestamp: toClickhouseDateTime(new Date(log.timestamp).toISOString()),
      attributes: log.attributes ?? {},
      service_name: escapeSql(service_name),
      trace_id: traceHex,
      span_id: spanHex,
    }
  })

  log.debug('Inserting logs into ClickHouse', { rows })

  try {
    await client.insert({ table: 'logs', values: rows, format: 'JSONEachRow' })
    return respond.OK()
  } catch (error) {
    log.error('Error inserting logs into ClickHouse:', { error })
    throw respond.InternalServerError()
  }
}

function toClickhouseDateTime(iso: string) {
  // "2025-09-11T17:35:00.000Z" → "2025-09-11 17:35:00"
  const match = iso.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?Z?$/,
  )
  if (!match) return iso.replace('T', ' ').replace(/(\.\d+)?Z$/, '')
  const [_, date, h, m, s] = match
  return `${date} ${h}:${m}:${s ?? '00'}`
}

async function getLogs({
  resource,
  level,
  startDate,
  endDate,
  sortBy,
  sortOrder,
  search,
}: {
  resource: string
  level?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  search?: Record<string, string>
}) {
  const queryParts: string[] = []
  const queryParams: Record<string, unknown> = { service_name: resource }

  queryParts.push('service_name = {service_name:String}')

  if (level) {
    queryParts.push('severity_number = {level:UInt8}')
    queryParams.level = level
  }

  if (startDate) {
    queryParts.push('timestamp >= {startDate:DateTime}')
    queryParams.startDate = toClickhouseDateTime(startDate)
  }

  if (endDate) {
    queryParts.push('timestamp <= {endDate:DateTime}')
    queryParams.endDate = toClickhouseDateTime(endDate)
  }

  if (search) {
    if (search.trace_id) {
      queryParts.push('trace_id = {trace_id:String}')
      queryParams.trace_id = search.trace_id
    }
    if (search.span_id) {
      queryParts.push('span_id = {span_id:String}')
      queryParams.span_id = search.span_id
    }
    if (search.event_name) {
      queryParts.push('event_name = {event_name:String}')
      queryParams.event_name = search.event_name
    }
  }

  const query = `
    SELECT *
    FROM logs
    WHERE ${queryParts.join(' AND ')}
    ${sortBy ? `ORDER BY ${sortBy} ${sortOrder || 'DESC'}` : ''}
    LIMIT 1000
  `

  try {
    const resultSet = await client.query({
      query,

      query_params: queryParams,
      format: 'JSON',
    })

    return (await resultSet.json<Log>()).data
  } catch (error) {
    log.error('Error querying logs from ClickHouse:', { error })
    throw respond.InternalServerError()
  }
}

export { client, getLogs, insertLogs, LogSchema, LogsInputSchema }
