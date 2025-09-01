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

export { client, insertLogs, LogSchema, LogsInputSchema }
