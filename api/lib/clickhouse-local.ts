import defer * as chdb from 'chdb'

export function createLocalClient(path: string) {
  const session = new chdb.Session(path)
  session.query(`SET date_time_input_format = 'best_effort'`)

  return {
    insert: (
      { table, values }: { table: string; values: unknown[]; format?: string },
    ) => {
      const data = values.map((v) => JSON.stringify(v)).join('\n')
      session.query(`INSERT INTO ${table} FORMAT JSONEachRow\n${data}`)
      return { executed: true, query_id: '' }
    },
    query: (
      { query, query_params }: {
        query: string
        query_params?: Record<string, unknown>
        format?: string
      },
    ) => {
      let q = query
      if (query_params) {
        for (const [key, value] of Object.entries(query_params)) {
          const str = typeof value === 'string'
            ? `'${value.replace(/'/g, "\\'")}'`
            : String(value)
          q = q.replace(new RegExp(`\\{${key}:\\w+\\}`, 'g'), str)
        }
      }
      const result = session.query(q, 'JSON')
      return { json: () => JSON.parse(result) }
    },
    ping: () => {
      session.query('SELECT 1')
      return { success: true }
    },
    command: ({ query }: { query: string }) => {
      session.query(query)
      return { query_id: '' }
    },
  }
}
