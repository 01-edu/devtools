import { client } from '/api/clickhouse-client.ts'

if (import.meta.main) {
  try {
    await client.ping()

    await client.command({
      query: `
      CREATE TABLE IF NOT EXISTS logs (
        id UUID DEFAULT generateUUIDv4(),
        -- Flattened resource fields
        service_name LowCardinality(String),
        service_version LowCardinality(String),
        service_instance_id String,

        timestamp DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
        observed_timestamp DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
        trace_id FixedString(16),
        span_id FixedString(16),
        severity_number UInt8,
        -- derived column, computed by DB from severity_number
        severity_text LowCardinality(String) MATERIALIZED CASE
          WHEN severity_number > 4 AND severity_number <= 8 THEN 'DEBUG'
          WHEN severity_number > 8 AND severity_number <= 12 THEN 'INFO'
          WHEN severity_number > 12 AND severity_number <= 16 THEN 'WARN'
          WHEN severity_number > 20 AND severity_number <= 24 THEN 'FATAL'
          ELSE 'ERROR'
        END,
        -- Often empty, but kept for OTEL spec compliance
        body Nullable(String),
        attributes JSON,
        event_name LowCardinality(String)
      )
      ENGINE = MergeTree
      PARTITION BY toYYYYMMDD(timestamp)
      ORDER BY (service_name, timestamp, trace_id)
      SETTINGS index_granularity = 8192, min_bytes_for_wide_part = 0;
    `,
    })

    console.log('logs table is ready')
  } catch (error) {
    console.error('Error creating ClickHouse table:', { error })
    Deno.exit(1)
  }
}
