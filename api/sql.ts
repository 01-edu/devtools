import { DatabaseSchemasCollection, DeploymentsCollection } from './schema.ts'
import { DB_SCHEMA_REFRESH_MS } from './lib/env.ts'
import { log } from './lib/log.ts'

async function runSQL(
  endpoint: string,
  token: string,
  query: string,
  params?: unknown,
) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, params }),
  })
  if (!res.ok) throw Error(`sql endpoint error ${res.status}`)
  const data = await res.json()

  return data
}

// Dialect detection attempts (run first successful)
const DETECTION_QUERIES: { name: string; sql: string; matcher: RegExp }[] = [
  {
    name: 'postgres',
    sql: 'SELECT version() as v',
    matcher: /postgres|cockroach/i,
  },
  { name: 'mysql', sql: 'SELECT VERSION() as v', matcher: /mysql|mariadb/i },
  {
    name: 'sqlite',
    sql: 'SELECT sqlite_version() as v',
    matcher: /\d+\.\d+\.\d+/,
  },
  {
    name: 'sqlserver',
    sql: 'SELECT @@VERSION as v',
    matcher: /microsoft sql server/i,
  },
  {
    name: 'oracle',
    sql: 'SELECT banner as v FROM v$version WHERE ROWNUM = 1',
    matcher: /oracle/i,
  },
  { name: 'duckdb', sql: 'PRAGMA version', matcher: /duckdb/i },
]

async function detectDialect(endpoint: string, token: string): Promise<string> {
  for (const d of DETECTION_QUERIES) {
    try {
      const rows = await runSQL(endpoint, token, d.sql)
      log.debug('dialect-detection', { dialect: d.name, rows })
      if (rows.length) {
        const text = JSON.stringify(rows[0])
        if (d.matcher.test(text)) return d.name
      }
    } catch { /* ignore */ }
  }
  return 'unknown'
}

// Introspection queries per dialect returning columns list
// Standardized output fields: table_schema (nullable), table_name, column_name, data_type, ordinal_position
const INTROSPECTION: Record<string, string> = {
  postgres:
    `SELECT table_schema, table_name, column_name, data_type, ordinal_position FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name, ordinal_position`,
  mysql:
    `SELECT table_schema, table_name, column_name, data_type, ordinal_position FROM information_schema.columns WHERE table_schema NOT IN ('mysql','information_schema','performance_schema','sys') ORDER BY table_schema, table_name, ordinal_position`,
  sqlserver:
    `SELECT table_schema = TABLE_SCHEMA, table_name = TABLE_NAME, column_name = COLUMN_NAME, data_type = DATA_TYPE, ordinal_position = ORDINAL_POSITION FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION`,
  oracle:
    `SELECT table_schema = owner AS table_schema, table_name, column_name, data_type, column_id AS ordinal_position FROM all_tab_columns ORDER BY owner, table_name, column_id`,
  duckdb:
    `SELECT table_schema, table_name, column_name, data_type, ordinal_position FROM information_schema.columns ORDER BY table_schema, table_name, ordinal_position`,
  sqlite:
    `SELECT NULL AS table_schema, m.name AS table_name, p.name AS column_name, p.type AS data_type, p.cid + 1 AS ordinal_position FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' ORDER BY m.name, p.cid`,
  unknown:
    `SELECT table_schema, table_name, column_name, data_type, ordinal_position FROM information_schema.columns ORDER BY table_schema, table_name, ordinal_position`,
}

async function fetchSchema(endpoint: string, token: string, dialect: string) {
  const sql = INTROSPECTION[dialect] ?? INTROSPECTION.unknown
  return await runSQL(endpoint, token, sql)
}

type ColumnInfo = { name: string; type: string; ordinal: number }
type TableInfo = {
  schema: string | undefined
  table: string
  columns: ColumnInfo[]
}

export async function refreshOneSchema(
  dep: ReturnType<typeof DeploymentsCollection.get>,
) {
  if (!dep || !dep.databaseEnabled || !dep.sqlEndpoint || !dep.sqlToken) return
  try {
    const dialect = await detectDialect(dep.sqlEndpoint, dep.sqlToken)
    const rows = await fetchSchema(dep.sqlEndpoint, dep.sqlToken, dialect)
    // group rows
    const tableMap = new Map<string, TableInfo>()
    for (const r of rows) {
      const schema = (r.table_schema as string) || undefined
      const table = r.table_name as string
      if (!table) continue
      const key = (schema ? schema + '.' : '') + table
      if (!tableMap.has(key)) tableMap.set(key, { schema, table, columns: [] })
      tableMap.get(key)!.columns.push({
        name: String(r.column_name),
        type: String(r.data_type || ''),
        ordinal: Number(r.ordinal_position || 0),
      })
    }
    const tables = [...tableMap.values()].map((t) => ({
      ...t,
      columns: t.columns.sort((a, b) => a.ordinal - b.ordinal),
    }))
    const payload = {
      deploymentUrl: dep.url,
      dialect,
      refreshedAt: new Date().toISOString(),
      tables: tables,
    }
    const existing = DatabaseSchemasCollection.get(dep.url)
    if (existing) {
      await DatabaseSchemasCollection.update(dep.url, payload)
    } else {
      await DatabaseSchemasCollection.insert(payload)
    }
    log.info('schema-refreshed', {
      deployment: dep.url,
      dialect,
      tables: tables.length,
    })
  } catch (err) {
    log.error('schema-refresh-failed', { deployment: dep.url, err })
  }
}

export async function refreshAllSchemas() {
  for (const dep of DeploymentsCollection.values()) {
    await refreshOneSchema(dep)
  }
}

let intervalHandle: number | undefined
export function startSchemaRefreshLoop() {
  if (intervalHandle) return
  // initial kick (non-blocking)
  refreshAllSchemas()
  intervalHandle = setInterval(() => {
    refreshAllSchemas()
  }, DB_SCHEMA_REFRESH_MS) as unknown as number
  log.info('schema-refresh-loop-started', { everyMs: DB_SCHEMA_REFRESH_MS })
}
