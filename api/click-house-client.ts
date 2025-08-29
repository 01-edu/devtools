import { createClient } from 'npm:@clickhouse/client'
import {
  CLICKHOUSE_HOST,
  CLICKHOUSE_PASSWORD,
  CLICKHOUSE_USER,
} from './lib/env.ts'

const client = createClient({
  url: CLICKHOUSE_HOST,
  username: CLICKHOUSE_USER,
  password: CLICKHOUSE_PASSWORD,
  compression: {},
})

try {
  await client.ping()

  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS logs (
        deployment_id LowCardinality(String),
        timestamp DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
        message String,
        log JSON,
        INDEX idx_message message TYPE tokenbf_v1(8192, 3, 0) GRANULARITY 4
      )
      ENGINE = MergeTree
      PARTITION BY toYYYYMMDD(timestamp)
      ORDER BY (deployment_id, timestamp)
      SETTINGS index_granularity = 8192, min_bytes_for_wide_part = 0;
    `,
  })

  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS log_attribute_keys
      (
        deployment_id LowCardinality(String),
        key_path String,
        data_type LowCardinality(String),
        last_seen DateTime DEFAULT now()
      )
      ENGINE = ReplacingMergeTree(last_seen)
      ORDER BY (deployment_id, key_path);
    `,
  })

  await client.command({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS log_key_extractor_mv
      TO log_attribute_keys
      AS
      SELECT
        deployment_id,
        -- On utilise l'alias du tuple .1 pour accéder au chemin
        arrayStringConcat(json_pair.1, '.') AS key_path,
        multiIf(
          -- On utilise l'alias du tuple .2 pour accéder à la valeur
          JSONType(json_pair.2) = 'Object', 'Object',
          JSONType(json_pair.2) = 'Array', 'Array',
          JSONType(json_pair.2) = 'String', 'String',
          JSONType(json_pair.2) = 'Number', 'Number',
          JSONType(json_pair.2) = 'Bool', 'Boolean',
          'Unknown'
        ) AS data_type,
        now() AS last_seen
      FROM logs
      -- LA CORRECTION EST ICI : on donne un seul alias au tuple
      ARRAY JOIN JSONAllPaths(log) AS json_pair
    `,
  })
  console.log('deployment_logs table is ready')
} catch (error) {
  console.error('Error creating ClickHouse table:', error)
}

async function getAvailableLogKeys(
  deploymentId: string,
): Promise<{ key: string; type: string }[]> {
  const resultSet = await client.query({
    query: `
      SELECT key_path AS key, data_type AS type
      FROM log_attribute_keys
      WHERE deployment_id = {deploymentId:String}
      ORDER BY key_path
    `,
    query_params: { deploymentId },
    format: 'JSONEachRow',
  })
  return await resultSet.json()
}

export { client }
