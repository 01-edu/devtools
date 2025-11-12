import {
  DatabaseSchemasCollection,
  Deployment,
  DeploymentsCollection,
} from './schema.ts'
import { DB_SCHEMA_REFRESH_MS } from './lib/env.ts'
import { log } from './lib/log.ts'

export class SQLQueryError extends Error {
  constructor(message: string, body: string) {
    super(message)
    this.type = 'unexpected'
    this.sqlMessage = 'unexpected error'
    try {
      const errorDetails = JSON.parse(body)
      const errorTypes = ['service-error', 'bad-query', 'timeout']
      if (errorTypes.includes(errorDetails.type)) this.type = errorDetails.type
      if (typeof errorDetails.sqlMessage === 'string') {
        this.sqlMessage = errorDetails.sqlMessage
      }
    } catch {
      this.sqlMessage = body
    }
  }
  type: 'service-error' | 'bad-query' | 'unexpected' | 'timeout'
  sqlMessage: string
}

export async function runSQL(
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
  const body = await res.text()
  if (res.ok) return JSON.parse(body)
  throw new SQLQueryError(`sql endpoint error ${res.status}`, body)
}

// Dialect detection attempts (run first successful)
const DETECTION_QUERIES: { name: string; sql: string; matcher: RegExp }[] = [
  {
    name: 'sqlite',
    sql: 'SELECT sqlite_version() as v',
    matcher: /\d+\.\d+\.\d+/,
  },
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
  sqlite:
    `SELECT NULL AS table_schema, m.name AS table_name, p.name AS column_name, p.type AS data_type, p.cid + 1 AS ordinal_position FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' ORDER BY m.name, p.cid`,
  unknown:
    `SELECT table_schema, table_name, column_name, data_type, ordinal_position FROM information_schema.columns ORDER BY table_schema, table_name, ordinal_position`,
}

async function fetchSchema(endpoint: string, token: string, dialect: string) {
  const sql = INTROSPECTION[dialect] ?? INTROSPECTION.unknown
  try {
    return await runSQL(endpoint, token, sql)
  } catch { /* ignore */ }
}

export type ColumnInfo = { name: string; type: string; ordinal: number }
type TableInfo = {
  schema: string | undefined
  table: string
  columns: ColumnInfo[]
  columnsMap: Map<string, ColumnInfo>
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
      if (!tableMap.has(key)) {
        tableMap.set(key, { schema, table, columns: [], columnsMap: new Map() })
      }
      tableMap.get(key)!.columns.push({
        name: String(r.column_name),
        type: String(r.data_type || ''),
        ordinal: Number(r.ordinal_position || 0),
      })
    }
    const tables = [...tableMap.values()].map((t) => ({
      ...t,
      columns: t.columns.sort((a, b) => a.ordinal - b.ordinal),
      columnsMap: t.columns.reduce((map, col) => {
        map.set(col.name, col)
        return map
      }, new Map<string, ColumnInfo>()),
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

type FetchTablesParams = {
  deployment: Deployment
  table: string
  filter: { key: string; comparator: string; value: string }[]
  sort: { key: string; order: 'ASC' | 'DESC' }[]
  limit: number
  offset: number
  search: string
}

const constructWhereClause = (
  params: FetchTablesParams,
  columnsMap: Map<string, ColumnInfo>,
) => {
  const whereClauses: string[] = []
  if (params.filter.length) {
    for (const filter of params.filter) {
      const { key, comparator, value } = filter
      const column = columnsMap.get(key)
      if (!column) {
        throw Error(`Invalid filter column: ${key}`)
      }
      const safeValue = value.replace(/'/g, "''")
      whereClauses.push(`${key} ${comparator} '${safeValue}'`)
    }
  }
  if (params.search) {
    const searchClauses = columnsMap.values().map((col) => {
      return `${col.name} LIKE '%${params.search.replace(/'/g, "''")}%'`
    }).toArray()
    if (searchClauses.length) {
      whereClauses.push(`(${searchClauses.join(' OR ')})`)
    }
  }
  return whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''
}

const constructOrderByClause = (
  params: FetchTablesParams,
  columnsMap: Map<string, ColumnInfo>,
) => {
  if (!params.sort.length) return ''
  const orderClauses: string[] = []
  for (const sort of params.sort) {
    const { key, order } = sort
    const column = columnsMap.get(key)
    if (!column) {
      throw Error(`Invalid sort column: ${key}`)
    }
    orderClauses.push(`${key} ${order}`)
  }
  return orderClauses.length ? 'ORDER BY ' + orderClauses.join(', ') : ''
}

export const fetchTablesData = async (
  params: FetchTablesParams,
  columnsMap: Map<string, ColumnInfo>,
) => {
  const { sqlEndpoint, sqlToken } = params.deployment
  if (!sqlToken || !sqlEndpoint) {
    throw Error('Missing SQL endpoint or token')
  }
  const whereClause = constructWhereClause(params, columnsMap)
  const orderByClause = constructOrderByClause(params, columnsMap)

  let limitOffsetClause = ''
  const limit = Math.floor(params.limit)

  if (params.limit && limit > 0) {
    limitOffsetClause += `LIMIT ${limit}`

    const offset = Math.floor(params.offset)
    if (params.offset && offset >= 0) {
      limitOffsetClause += ` OFFSET ${offset}`
    }
  }

  const query =
    `SELECT * FROM ${params.table} ${whereClause} ${orderByClause} ${limitOffsetClause}`
  const countQuery =
    `SELECT COUNT(*) as count FROM ${params.table} ${whereClause}`
  const rows = await runSQL(sqlEndpoint, sqlToken, query)

  return {
    rows,
    totalRows: limit > 0
      ? ((await runSQL(sqlEndpoint, sqlToken, countQuery))[0].count) as number
      : rows.length,
  }
}
