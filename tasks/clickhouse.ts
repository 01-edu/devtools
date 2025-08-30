import { client } from '../api/click-house-client.ts'
import { log } from '../api/lib/log.ts'

if (import.meta.main) {
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

    log.info('logs table is ready')
  } catch (error) {
    log.error('Error creating ClickHouse table:', { error })
    Deno.exit(1)
  }
}
