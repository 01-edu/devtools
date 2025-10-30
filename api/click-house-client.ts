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

export const LogSchemaOutput = OBJ({
  timestamp: NUM('The timestamp of the log event'),
  trace_id: STR('A float64 representation of the trace ID'),
  span_id: STR('A float64 representation of the span ID'),
  severity_number: NUM('The severity number of the log event'),
  severity_text: STR('The severity text of the log event'),
  body: optional(STR('The body of the log event')),
  attributes: OBJ({}, 'A map of attributes'),
  event_name: STR('The name of the event'),
  service_name: STR('The service name'),
  service_version: optional(STR('Service version')),
  service_instance_id: optional(STR('Service instance ID')),
}, 'A log event')

const LogsInputSchema = UNION(
  LogSchema,
  ARR(LogSchema, 'An array of log events'),
)

type Log = Asserted<typeof LogSchemaOutput>
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

type FetchTablesParams = {
  filter: { key: string; comparator: string; value: string }[]
  sort: { key: string; order: 'ASC' | 'DESC' }[]
  limit: number
  offset: number | undefined
  search: string | undefined
}

const severityMap = {
  DEBUG: [5, 8],
  INFO: [9, 12],
  WARN: [13, 16],
  ERROR: [17, 20],
  FATAL: [21, 24],
} as const

const searchFields = ['body', 'service_instance_id', 'event_name']

const splitFirst = (s: string, sep: string): [string, string] => {
  const i = s.indexOf(sep)
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + sep.length)]
}

function buildLogsQuery(dep: string, p: FetchTablesParams) {
  const where: string[] = ['service_name = {service_name:String}']
  const params: Record<string, unknown> = { service_name: dep }

  if (p.search?.trim()) {
    where.push(
      `(${searchFields.map((f) => `${f} ILIKE {search:String}`).join(' OR ')})`,
    )
    params.search = `%${p.search.trim()}%`
  }

  for (const { key, comparator, value } of p.filter) {
    if (key === 'severity_text') {
      const range = severityMap[value.toUpperCase() as keyof typeof severityMap]
      if (range) {
        where.push(
          comparator === '='
            ? `severity_number BETWEEN ${range[0]} AND ${range[1]}`
            : `(severity_number < ${range[0]} OR severity_number > ${
              range[1]
            })`,
        )
        continue
      }
    }

    if (key === 'attributes') {
      const [jsonPath, target] = splitFirst(value, ':')
      const varName = `attr_${jsonPath.replace(/\W/g, '_')}`
      where.push(`${key}.${jsonPath} ${comparator} {${varName}:String}`)
      params[varName] = target
      continue
    }

    if (/^(null|NULL)$/i.test(value)) {
      where.push(`${key} IS ${comparator === '=' ? '' : 'NOT '}NULL`)
      continue
    }

    const varName = `f_${key}`
    where.push(
      `${key} ${comparator} {${varName}:${inferParamType(key, value)}}`,
    )
    params[varName] = value
  }

  const order = p.sort.length
    ? p.sort.map((s) => `${s.key} ${s.order}`).join(', ')
    : 'observed_timestamp DESC, trace_id'

  params.limit = p.limit
  params.offset = p.offset

  const clauses = [
    where.length && `WHERE ${where.join(' AND ')}`,
    `ORDER BY ${order}`,
    `LIMIT {limit:UInt64} OFFSET {offset:UInt64}`,
  ].filter(Boolean)

  return { query: `SELECT * FROM logs ${clauses.join(' ')}`, params }
}

function inferParamType(key: string, value: string): string {
  if (key.includes('timestamp') || key.includes('time')) return 'DateTime'
  if (/^\d+$/.test(value)) return 'Int64'
  if (/^\d+\.\d+$/.test(value)) return 'Float64'
  return 'String'
}

async function getLogs(dep: string, data: FetchTablesParams) {
  const { query, params } = buildLogsQuery(dep, data)
  try {
    const rs = await client.query({
      query,
      query_params: params,
      format: 'JSON',
    })
    return (await rs.json<Log>()).data
  } catch (e) {
    log.error('ClickHouse query failed', { error: e, query, params })
    throw respond.InternalServerError()
  }
}

// Example usage
// console.log(await getLogs('localhost:8000', {
//   search: '',
//   filter: [
//     { key: 'attributes', comparator: '>', value: 'duration:0.003' },
//     { key: 'event_name', comparator: '=', value: 'out' },
//   ],
//   sort: [{ key: 'timestamp', order: 'DESC' }],
//   limit: 3,
//   offset: 1,
// }))

// ClickHouse query: {
//   query: "SELECT * FROM logs WHERE service_name = {service_name:String} AND attributes.duration > {attr_duration:String} AND event_name = {f_event_name:String} ORDER BY timestamp DESC LIMIT {limit:UInt64} OFFSET {offset:UInt64}",
//   params: {
//     service_name: "localhost:8000",
//     attr_duration: "0.003",
//     f_event_name: "out",
//     limit: 3,
//     offset: 1
//   }
// }

export { client, getLogs, insertLogs, LogSchema, LogsInputSchema }
