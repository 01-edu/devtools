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
  clickhouse_settings: {
    date_time_input_format: 'best_effort',
  },
})

const numberToHex128 = (() => {
  const alphabet = new TextEncoder().encode('0123456789abcdef')
  const output = new Uint8Array(16)
  const view = new DataView(new Uint8Array(8).buffer)
  const dec = new TextDecoder()
  return (id: number) => {
    view.setFloat64(0, id, false)
    let i = -1
    while (++i < 8) {
      const x = view.getUint8(i)
      output[i * 2] = alphabet[x >> 4]
      output[i * 2 + 1] = alphabet[x & 0xF]
    }
    return dec.decode(output)
  }
})()

async function insertLogs(
  service_name: string,
  data: LogsInput,
) {
  const logsToInsert = Array.isArray(data) ? data : [data]
  if (logsToInsert.length === 0) throw respond.NoContent()

  const rows = logsToInsert.map((log) => {
    const traceHex = numberToHex128(log.trace_id)
    const spanHex = numberToHex128(log.span_id ?? log.trace_id)
    return {
      ...log,
      timestamp: new Date(log.timestamp),
      attributes: log.attributes ?? {},
      service_name: service_name,
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

async function getLogs({
  resource,
  severity_number,
  start_date,
  end_date,
  sort_by,
  sort_order,
  search,
}: {
  resource: string
  severity_number?: string
  start_date?: string
  end_date?: string
  sort_by?: string
  sort_order?: 'ASC' | 'DESC'
  search?: Record<string, string>
}) {
  const queryParts: string[] = []
  const queryParams: Record<string, unknown> = { service_name: resource }

  queryParts.push('service_name = {service_name:String}')
  queryParams.service_name = resource

  if (severity_number) {
    queryParts.push('severity_number = {severity_number:UInt8}')
    queryParams.severity_number = severity_number
  }

  if (start_date) {
    queryParts.push('timestamp >= {start_date:DateTime}')
    queryParams.start_date = new Date(start_date)
  }

  if (end_date) {
    queryParts.push('timestamp <= {end_date:DateTime}')
    queryParams.end_date = new Date(end_date)
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
    ${sort_by ? `ORDER BY ${sort_by} ${sort_order || 'DESC'}` : ''}
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
