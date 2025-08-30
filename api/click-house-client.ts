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
  severity_text: STR(),
  severity_number: NUM(),
  attributes: OBJ({}),
  event_name: STR(),
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

try {
  await client.ping()

  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS logs (
        resource String,
        timestamp DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
        observed_timestamp DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
        trace_id UInt64,
        span_id UInt64,
        severity_text String,
        severity_number UInt8,
        attributes JSON,
        event_name String
      )
      ENGINE = MergeTree
      PARTITION BY toYYYYMMDD(timestamp)
      ORDER BY (resource, timestamp, trace_id)
      SETTINGS index_granularity = 8192, min_bytes_for_wide_part = 0;
    `,
  })

  log.info('deployment_logs table is ready')
} catch (error) {
  log.error('Error creating ClickHouse table:', { error })
  Deno.exit(1)
}

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
    log.error("Erreur lors de l'insertion des logs dans ClickHouse:", { error })
    throw respond.InternalServerError()
  }
}

export { client, insertLogs, LogSchema, LogsInputSchema }
