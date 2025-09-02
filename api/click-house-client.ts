import { createClient } from 'npm:@clickhouse/client'
import {
  CLICKHOUSE_HOST,
  CLICKHOUSE_PASSWORD,
  CLICKHOUSE_USER,
} from './lib/env.ts'
import { respond } from './lib/response.ts'
import { log } from './lib/log.ts'
import { ARR, NUM, OBJ, STR, UNION } from './lib/validator.ts'
import { Asserted } from './lib/router.ts'

const LogSchema = OBJ({
  timestamp: STR(),
  trace_id: STR(),
  span_id: STR(),
  severity_number: NUM(),
  attributes: OBJ({}),
  event_name: STR(),
  context: OBJ({}),
})

const LogsInputSchema = UNION(LogSchema, ARR(LogSchema))

export type Log = Asserted<typeof LogSchema>
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

async function insertLogs(
  resource: string,
  data: LogsInput,
) {
  const logsToInsert = Array.isArray(data) ? data : [data]
  if (logsToInsert.length === 0) {
    throw respond.NoContent()
  }

  const values = logsToInsert.map((log) => ({
    ...log,
    resource,
  }))

  try {
    await client.insert({
      table: 'logs',
      values,
      format: 'JSONEachRow',
    })
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
  const queryParams: Record<string, unknown> = { resource }

  queryParts.push('resource = {resource:String}')

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
      format: 'JSONEachRow',
    })

    return resultSet.json<Log[]>()
  } catch (error) {
    log.error('Error querying logs from ClickHouse:', { error })
    throw respond.InternalServerError()
  }
}

export { client, getLogs, insertLogs, LogSchema, LogsInputSchema }
