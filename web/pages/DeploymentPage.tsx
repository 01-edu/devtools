import { A, navigate, url } from '@01edu/signal-router'
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns,
  Download,
  Eye,
  FileText,
  Hash,
  Info,
  Link2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Table,
  XCircle,
} from 'lucide-preact'
import {
  FilterMenu,
  parseFilters,
  parseSort,
  SortMenu,
} from '../components/Filtre.tsx'
import { effect, Signal } from '@preact/signals'
import { api } from '../lib/api.ts'
import { QueryHistory } from '../components/QueryHistory.tsx'

import { JSX } from 'preact'
import {
  deployments,
  querier,
  queriesHistory,
  runQuery,
  sidebarItems,
} from '../lib/shared.tsx'

type AnyRecord = Record<string, unknown>
// API signals for schema and table data
const schema = api['GET/api/deployment/schema'].signal()
// API signal for table data
export const tableData = api['POST/api/deployment/table/data'].signal()

// Effect to fetch schema when deployment URL changes
effect(() => {
  const dep = url.params.dep
  if (dep) {
    schema.fetch({ url: dep })
  }
})

const queryHash = new Signal<string>('')
effect(() => {
  const query = (url.params.q || '').trim()
  if (query) {
    hashQuery(query).then((hash) => {
      queryHash.value = hash
    })
  } else {
    queryHash.value = ''
  }
})

function sha(message: string) {
  const data = new TextEncoder().encode(message)
  return crypto.subtle.digest('SHA-1', data)
}

function hashQuery(query: string) {
  const hash = sha(query).then((hashBuffer) => {
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join(
      '',
    )
    return hashHex
  })
  return hash
}

const onSave = () => {
  const query = (url.params.q || '').trim()
  if (query) {
    if (!queryHash.value) return
    queriesHistory.value = {
      ...queriesHistory.value,
      [queryHash.value]: {
        query,
        timestamp: new Date().toISOString(),
      },
    }
  }
}

const onDownload = () => {
  const query = (url.params.q || '').trim()
  if (query && querier.data?.rows) {
    if (!queryHash.value) return
    const rows = querier.data.rows
    const json = {
      hash: queryHash.value,
      query,
      rows,
      metadata: {
        downloadedAt: new Date().toISOString(),
        duration: querier.data?.duration,
        rowCount: rows.length,
      },
    }
    const blob = new Blob([JSON.stringify(json, null, 2)], {
      type: 'application/json;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query-${queryHash.value}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
}

const LineNumbers = () => {
  const lineCount = Math.max(1, (url.params.q?.match(/\n/g)?.length ?? 0) + 1)

  return (
    <div class='absolute inset-y-0 left-0 w-11 select-none overflow-hidden border-r border-base-300 z-10'>
      <div class='m-0 px-2.5 py-3 text-xs font-mono text-base-content/50 leading-6 text-right'>
        {Array(lineCount)
          .keys().map((i) => <div key={i}>{i + 1}</div>).toArray()}
      </div>
    </div>
  )
}

const handleInput = (e: Event) => {
  const v = (e.target as HTMLTextAreaElement).value
  navigate({ params: { q: v }, replace: true })
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (!((e.ctrlKey || e.metaKey) && e.key === 'Enter')) return
  e.preventDefault()
  runQuery(url.params.q || '')
}

const SQLEditor = () => (
  <div class='resize-y min-h-[120px] max-h-[80vh] overflow-hidden border border-base-300 rounded-lg bg-base-100'>
    <div class='relative h-full bg-base-100 rounded-lg overflow-hidden focus-within:border-primary/50 transition-colors'>
      <LineNumbers />
      <textarea
        value={url.params.q || ''}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        class='w-full h-full font-mono text-sm leading-6 pl-12 pr-4 py-3 bg-transparent border-0 focus:outline-none focus:ring-0 text-base-content caret-primary resize-none tracking-wide placeholder:text-base-content/40'
        placeholder='SELECT * FROM users WHERE active = true;'
        aria-label='SQL editor'
        spellcheck={false}
        autocapitalize='off'
        autocomplete='off'
      />
    </div>
  </div>
)

const QueryStatus = () => (
  <div class='flex items-center gap-2'>
    {querier.pending
      ? (
        <div class='flex items-center gap-2'>
          <div class='w-2 h-2 bg-primary rounded-full animate-pulse' />
          <span class='text-xs text-base-content/60'>Running…</span>
        </div>
      )
      : (
        <span class='text-xs text-base-content/60'>
          {querier.data?.rows.length ?? 0} rows
        </span>
      )}
  </div>
)

function ErrorDisplay() {
  if (!querier.error) return null

  return (
    <div class='flex items-center gap-2 bg-error/10 border border-error/20 rounded-lg px-3 py-1.5'>
      <AlertTriangle class='h-4 w-4 text-error' />
      <span class='text-xs text-error font-medium'>
        {querier.error.message}
      </span>
    </div>
  )
}

function ExecutionTime() {
  if (!querier.data?.duration) return null

  return (
    <div class='text-xs text-base-content/60 tabular-nums flex items-center gap-1'>
      <Clock class='h-3 w-3' />
      Query took {querier.data.duration.toFixed(2)} seconds
    </div>
  )
}

function ResultsHeader() {
  return (
    <div class='bg-base-100 border-t border-base-300 px-4 sm:px-6 py-3 shrink-0'>
      <div class='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
        <div class='flex items-center gap-3'>
          <h2 class='text-sm sm:text-base font-medium'>Results</h2>
          <QueryStatus />
          <ErrorDisplay />
        </div>
        <ExecutionTime />
      </div>
    </div>
  )
}

function QueryEditor() {
  return (
    <div class='flex flex-col h-full min-h-0 gap-2 grow-1'>
      <SQLEditor />
      <ResultsHeader />
      <div class='flex-1 min-h-0 overflow-hidden'>
        <DataTable />
      </div>
    </div>
  )
}

const pageSize = 50

export const comparators = {
  'eq': '=',
  'neq': '!=',
  'lt': '<',
  'lte': '<=',
  'gt': '>',
  'gte': '>=',
  'like': 'LIKE',
  'ilike': 'ILIKE',
} as const

export type Order = 'ASC' | 'DESC'

// Effect to fetch table data when filters, sort, or search change
effect(() => {
  const { dep, tab, table, qt, tpage } = url.params
  if (dep && tab === 'tables') {
    const tableName = table || schema.data?.tables?.[0]?.table
    if (tableName) {
      const filterRows = parseFilters('t').filter((r) =>
        r.key !== 'key' && r.value
      ).map((r) => ({
        key: r.key,
        comparator: comparators[r.op as keyof typeof comparators],
        value: r.value,
      }))
      const sortRows = parseSort('t').filter((r) =>
        r.key !== 'key' && r.key && r.dir
      ).map((r) => ({
        key: r.key,
        order: r.dir === 'asc' ? 'ASC' : 'DESC' as Order,
      }))

      tableData.fetch({
        deployment: dep,
        table: tableName,
        filter: filterRows,
        sort: sortRows,
        search: qt || '',
        limit: pageSize,
        offset: (Number(tpage) || 0) * pageSize,
      })
    }
  }
})

const RowNumberCell = ({ index }: { index: number }) => (
  <td class='sticky left-0 bg-base-100 tabular-nums font-medium text-xs text-base-content/60 w-16 max-w-[4rem]'>
    {(Number(url.params.tpage) || 0) * pageSize + index + 1}
  </td>
)

const TableCell = ({ value }: { value: unknown }) => {
  const isObj = typeof value === 'object' && value !== null
  const stringValue = isObj ? JSON.stringify(value) : String(value ?? '')
  const isTooLong = stringValue.length > 100

  if (isObj) {
    return (
      <code
        class='font-mono text-xs text-base-content/70 block overflow-hidden text-ellipsis whitespace-nowrap'
        title={isTooLong ? stringValue : undefined}
      >
        {stringValue}
      </code>
    )
  }

  return (
    <span
      class='block overflow-hidden text-ellipsis whitespace-nowrap text-sm'
      title={isTooLong ? stringValue : undefined}
    >
      {stringValue}
    </span>
  )
}

const EmptyRow = ({ colSpan }: { colSpan: number }) => (
  <tr>
    <td class='p-6 text-base-content/60 text-center' colSpan={colSpan}>
      <div class='flex flex-col items-center gap-2 py-4'>
        <Table class='h-12 w-12 text-base-content/30' />
        <span class='text-sm'>No results to display</span>
      </div>
    </td>
  </tr>
)

const DataRow = (
  { row, columns, index }: { row: AnyRecord; columns: string[]; index: number },
) => (
  <tr class='hover:bg-base-200/50'>
    <RowNumberCell index={index} />
    {columns.map((key, i) => (
      <td key={i} class='align-top min-w-[8rem] max-w-[20rem]'>
        <TableCell value={row[key]} />
      </td>
    ))}
  </tr>
)

const TableHeader = ({ columns }: { columns: string[] }) => (
  <thead class='sticky top-0 bg-base-100 shadow-sm'>
    <tr>
      <th class='sticky left-0 bg-base-100 w-16 min-w-[3rem] max-w-[4rem]'>
        <span class='text-xs font-semibold text-base-content/70'>#</span>
      </th>
      {columns.length > 0
        ? (
          columns.map((key) => (
            <th
              key={key}
              class='whitespace-nowrap min-w-[8rem] max-w-[20rem] font-semibold text-base-content/70'
              title={key}
            >
              <span class='truncate block'>{key}</span>
            </th>
          ))
        )
        : <th class='text-left'>No columns</th>}
    </tr>
  </thead>
)

const PaginationControls = ({ totalPages }: { totalPages: number }) => {
  const tpage = Number(url.params.tpage) || 0
  const page = tpage + 1
  const hasNext = page < totalPages
  const hasPrev = page > 1
  return (
    <div class='join'>
      <A
        params={{ tpage: tpage - 1 }}
        class={`join-item btn btn-sm ${hasPrev ? '' : 'btn-disabled'}`}
        aria-label='Previous page'
      >
        ‹
      </A>
      <A
        params={{ tpage: tpage + 1 }}
        class={`join-item btn btn-sm ${hasNext ? '' : 'btn-disabled'}`}
        aria-label='Next page'
      >
        ›
      </A>
    </div>
  )
}

const TableFooter = ({ rows }: { rows: AnyRecord[] }) => {
  const page = (Number(url.params.tpage) || 0) + 1
  const totalPages = Math.max(
    1,
    Math.ceil((tableData.data?.totalRows || 0) / pageSize),
  )

  return (
    <div class='bg-base-100 border-t border-base-300 px-4 sm:px-6 py-3 shrink-0'>
      <div class='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-base-content/60'>
        <span class='font-medium'>
          {rows.length > 0
            ? `${rows.length.toLocaleString()} row${
              rows.length !== 1 ? 's' : ''
            }`
            : 'No rows'}
        </span>
        <div class='flex items-center gap-2'>
          <span class='hidden sm:inline'>Page {page} of {totalPages}</span>
          <PaginationControls totalPages={totalPages} />
        </div>
      </div>
    </div>
  )
}

const TableContent = ({ rows }: { rows: AnyRecord[] }) => {
  const columns = Object.keys(rows[0] || {})
  return (
    <table class='table table-zebra min-w-full'>
      <TableHeader columns={columns} />
      <tbody>
        {rows.length === 0
          ? <EmptyRow colSpan={Math.max(2, columns.length + 1)} />
          : (
            rows.map((row, index) => (
              <DataRow
                key={index}
                row={row}
                columns={columns}
                index={index}
              />
            ))
          )}
      </tbody>
    </table>
  )
}
const DataTable = () => {
  const tab = url.params.tab

  const rows = tab === 'tables'
    ? tableData.data?.rows || []
    : tab === 'queries'
    ? querier.data?.rows || []
    : []

  return (
    <div class='flex flex-col h-full min-h-0 grow-1'>
      <div class='flex-1 min-h-0 overflow-hidden'>
        <div class='w-full overflow-x-auto overflow-y-auto h-full'>
          <TableContent rows={rows} />
        </div>
      </div>
      <TableFooter rows={rows} />
    </div>
  )
}

function Header() {
  const item = sidebarItems[url.params.sbi || Object.keys(sidebarItems)[0]]
  const dep = url.params.dep
  if (!dep && deployments.data?.length) {
    navigate({ params: { dep: deployments.data[0].url }, replace: true })
  }

  const onChangeDeployment = (e: Event) => {
    const v = (e.target as HTMLSelectElement).value
    navigate({
      params: { dep: v, table: null, ft: null, st: null, qt: null },
      replace: true,
    })
  }

  return (
    <div class='navbar bg-base-100 border-b border-base-300 sticky top-0'>
      <div class='flex-1 min-w-0'>
        <div class='flex items-center gap-4 md:gap-6'>
          <div class='flex items-center gap-3 min-w-0'>
            <item.icon class='h-6 w-6 text-orange-500 shrink-0' />
            <span class='text-base md:text-lg font-semibold truncate'>
              {item.label}
            </span>
          </div>
          <div class='min-w-[12rem]'>
            <select
              class='select select-sm md:select-md w-full'
              value={dep || ''}
              onChange={onChangeDeployment}
            >
              {deployments.data?.map((deployment) => (
                <option value={deployment.url} key={deployment.url}>
                  {deployment.url}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div class='flex-none'>
        <A
          params={{ drawer: 'history' }}
          class='btn btn-outline btn-xs md:btn-sm drawer-button'
        >
          <FileText class='h-4 w-4 mr-2' />
          <span class='hidden sm:inline'>Saved Queries</span>
        </A>
      </div>
    </div>
  )
}

function SchemaPanel() {
  const dep = url.params.dep

  const grouped: Record<
    string,
    NonNullable<NonNullable<typeof schema.data>['tables']>
  > = {}
  if (schema.data?.tables) {
    for (const table of schema.data.tables) {
      const schemaName = table.schema || 'default'
      if (!grouped[schemaName]) grouped[schemaName] = []
      grouped[schemaName].push(table)
    }
  }

  // Track which table is expanded
  const expandedTable = url.params.expanded
  const selectedTable = url.params.table

  return (
    <aside class='hidden lg:flex w-72 bg-base-100 border-r border-base-300 flex-col shrink-0'>
      <div class='flex-1 overflow-y-auto'>
        <div class='p-3 border-b border-base-300 sticky top-0 bg-base-100'>
          <div class='flex items-center justify-between'>
            <div class='text-xs text-base-content/60'>
              {schema.pending
                ? 'Loading...'
                : schema.error
                ? 'Error loading schema'
                : `Tables (${schema.data?.tables?.length || 0})`}
            </div>
            <div class='flex items-center gap-2'>
              {dep && (
                <button
                  type='button'
                  class='btn btn-ghost btn-xs'
                  disabled={schema.pending !== undefined}
                  onClick={() => {
                    schema.fetch({ url: dep })
                  }}
                  title='Refresh schema'
                >
                  <RefreshCw
                    class={`h-3 w-3 ${schema.pending ? 'animate-spin' : ''}`}
                  />
                </button>
              )}
              <div class='text-xs text-base-content/40'>
                {schema.data?.dialect}
              </div>
            </div>
          </div>
        </div>
        {schema.error && (
          <div class='alert alert-error alert-sm'>
            <AlertCircle class='h-4 w-4' />
            <span class='text-sm'>Failed to load schema</span>
          </div>
        )}

        {schema.pending && (
          <div class='flex items-center justify-center py-8'>
            <span class='loading loading-spinner loading-sm'></span>
          </div>
        )}

        {!schema.pending && !schema.error && schema.data && (
          <div class='space-y-2 p-2'>
            {Object.entries(grouped).map(([schemaName, tables]) => (
              <div key={schemaName} class='space-y-1'>
                {schemaName !== 'default' && (
                  <div class='text-xs font-medium text-base-content px-2 py-1 bg-base-200/50 rounded'>
                    {schemaName}
                  </div>
                )}
                {tables.map((table) => {
                  const isExpanded = expandedTable === table.table
                  const isSelected = selectedTable === table.table
                  return (
                    <div
                      key={table.table}
                      class={`rounded-md overflow-hidden border ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-base-300/50'
                      }`}
                    >
                      <div class='flex items-center gap-2 p-2 hover:bg-base-200 w-full text-left transition-colors'>
                        <A
                          params={{ expanded: isExpanded ? null : table.table }}
                          class='shrink-0 p-1 hover:bg-base-300 rounded transition-colors flex items-center justify-center'
                        >
                          {isExpanded
                            ? (
                              <ChevronDown class='h-4 w-4 text-base-content/60' />
                            )
                            : (
                              <ChevronRight class='h-4 w-4 text-base-content/60' />
                            )}
                        </A>

                        <A
                          params={{
                            tab: 'tables',
                            table: table.table,
                            ft: null,
                            st: null,
                            qt: null,
                          }}
                          class='flex items-center gap-2 flex-1 min-w-0'
                        >
                          <Table class='h-4 w-4 text-primary shrink-0' />
                          <div class='flex-1 min-w-0'>
                            <div
                              class='font-medium text-sm truncate'
                              title={table.table}
                            >
                              {table.table}
                            </div>
                            <div class='flex items-center gap-2 text-xs text-base-content/50'>
                              <span class='flex items-center gap-1'>
                                <Columns class='h-3 w-3' />
                                {table.columns.length}
                              </span>
                            </div>
                          </div>
                        </A>
                      </div>

                      {isExpanded && (
                        <div class='bg-base-200/30 px-2 pb-2 border-t border-base-300/50'>
                          <div class='text-xs font-medium text-base-content/60 px-2 py-1.5 sticky top-[57px] bg-base-200/50'>
                            Columns
                          </div>
                          <div class='space-y-0.5 max-h-64 overflow-y-auto'>
                            {table.columns.map((col, idx) => (
                              <div
                                key={idx}
                                class='flex items-center gap-2 px-2 py-1 text-xs hover:bg-base-200 rounded'
                              >
                                <Columns class='h-3 w-3 text-base-content/40' />
                                <span
                                  class='font-mono truncate'
                                  title={col.name}
                                >
                                  {col.name}
                                </span>
                                <span class='text-base-content/40 text-[10px] ml-auto'>
                                  {col.type}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

const TabButton = ({ tabName }: { tabName: 'tables' | 'queries' | 'logs' }) => (
  <A
    params={{ tab: tabName }}
    role='tab'
    class={`tab whitespace-nowrap capitalize ${
      url.params.tab === tabName ? 'tab-active' : ''
    }`}
  >
    {tabName}
  </A>
)

function TabNavigation({
  activeTab = 'tables',
}: { activeTab?: 'tables' | 'queries' | 'logs' }) {
  // Get column names from the currently selected table for tables tab
  const selectedTableName = url.params.table || schema.data?.tables?.[0]?.table
  const selectedTable = schema.data?.tables?.find((t) =>
    t.table === selectedTableName
  )
  const tableColumnNames = selectedTable?.columns.map((c) => c.name) || []

  const filterKeyOptions = activeTab === 'tables' ? tableColumnNames : [
    'timestamp',
    'trace_id',
    'span_id',
    'severity_number',
    'severity_text',
    'body',
    'attributes',
    'event_name',
    'service_version',
    'service_instance_id',
  ] as const

  const querySaved = Boolean(queriesHistory.value[queryHash.value])
  const tableKey = url.params.tab === 'tables' ? 'qt' : 'lq'
  return (
    <div class='bg-base-100 border-b border-base-300 relative'>
      <div class='flex flex-col sm:flex-row gap-2 px-2 sm:px-4 md:px-6 py-2'>
        <div class='tabs tabs-lifted w-full overflow-x-auto'>
          <TabButton tabName='tables' />
          <TabButton tabName='queries' />
          <TabButton tabName='logs' />
        </div>

        <div class='flex flex-wrap items-center gap-2 shrink-0'>
          {(activeTab === 'tables' || activeTab === 'logs') && (
            <label class='input input-sm min-w-0 w-full sm:w-64'>
              <Search class='opacity-50' />
              <input
                type='search'
                class='grow'
                placeholder='Search'
                value={url.params[tableKey] || ''}
                onInput={(e) => {
                  const value = (e.target as HTMLInputElement).value
                  navigate({
                    params: { [tableKey]: value || null },
                    replace: true,
                  })
                }}
              />
            </label>
          )}
          {activeTab !== 'logs' && (
            <A
              params={{ drawer: activeTab === 'tables' ? 'insert' : null }}
              onClick={activeTab === 'queries'
                ? () => runQuery(url.params.q || '')
                : undefined}
              class='btn btn-primary btn-sm'
            >
              {activeTab === 'queries'
                ? <Play class='h-4 w-4' />
                : <Plus class='h-4 w-4' />}
              <span class='hidden sm:inline'>
                {activeTab === 'queries' ? 'Run query' : 'Insert row'}
              </span>
            </A>
          )}
          {activeTab !== 'queries' && (
            <>
              <FilterMenu filterKeyOptions={filterKeyOptions} tag={activeTab} />
              <SortMenu sortKeyOptions={filterKeyOptions} tag={activeTab} />
            </>
          )}
          {activeTab === 'queries' && (
            <>
              <button
                disabled={querySaved}
                onClick={onSave}
                type='button'
                class='btn btn-outline btn-sm'
              >
                <Save class='h-4 w-4' />
                <span class='hidden sm:inline'>Save</span>
              </button>
              <button
                onClick={onDownload}
                type='button'
                class='btn btn-outline btn-sm'
              >
                <Download class='h-4 w-4' />
                <span class='hidden sm:inline'>Download</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const logData = api['POST/api/deployment/logs'].signal()
effect(() => {
  const { dep, lq } = url.params
  if (dep) {
    const filterRows = parseFilters('l').filter((r) =>
      r.key !== 'key' && r.value
    ).map((r) => ({
      key: r.key,
      comparator: comparators[r.op as keyof typeof comparators],
      value: r.value,
    }))
    const sortRows = parseSort('l').filter((r) =>
      r.key !== 'key' && r.key && r.dir
    ).map((r) => ({
      key: r.key,
      order: r.dir === 'asc' ? 'ASC' : 'DESC' as Order,
    }))
    logData.fetch({
      deployment: dep || '',
      filter: filterRows,
      sort: sortRows,
      search: lq || '',
      limit: 100,
      offset: 0,
    })
  }
})

const parseHex128 = (() => {
  const alphabet = new TextEncoder().encode('0123456789abcdef')
  const alphabetMap = new Uint8Array(256)
  const enc = new TextEncoder()
  alphabet.forEach((c, i) => alphabetMap[c] = i)
  return (encoded: string) => {
    const bytes = enc.encode(encoded)
    const buffer = new Uint8Array(8)
    const view = new DataView(buffer.buffer)
    let i = -1
    while (++i < 8) {
      const hi = alphabetMap[bytes[i * 2]]!
      const lo = alphabetMap[bytes[i * 2 + 1]]!
      buffer[i] = (hi << 4) | lo
    }
    const value = view.getFloat64(0, false)
    return {
      value,
      short: encoded.slice(8),
      hue: (((value - Math.trunc(value)) * 100000) % 3600) / 10,
    }
  }
})()

const severityConfig = {
  DEBUG: { icon: Bug, color: 'text-info', bg: 'bg-info/10' },
  INFO: { icon: Info, color: 'text-info', bg: 'bg-info/10' },
  WARN: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  ERROR: { icon: XCircle, color: 'text-error', bg: 'bg-error/10' },
  FATAL: { icon: AlertCircle, color: 'text-error', bg: 'bg-error/10' },
} as const

const dateFmtConfig = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
} as const

const safeFormatTimestamp = (timestamp: Date) =>
  timestamp.toLocaleString('en-UK', dateFmtConfig)
    .split(', ').reverse().join(' ')

const logThreads = [
  'Timestamp',
  'Severity',
  'Event',
  'Trace',
  'Span',
  'Attributes',
] as const

const Hex128 = ({ hex, type }: { hex: string; type: 'trace' | 'span' }) => {
  const { hue, short, value } = parseHex128(hex)
  const Icon = type === 'trace' ? Link2 : Hash

  return (
    <div
      class='badge badge-outline badge-sm border-current/20'
      title={`${type}: ${hex} (${value})`}
      style={{
        color: `oklch(0.93 0.15 ${hue})`,
        backgroundColor: `oklch(0.25 0.01 ${hue})`,
      }}
    >
      <Icon class='w-3 h-3 mr-1' />
      <span class='uppercase truncate'>{short}</span>
    </div>
  )
}

function LogsViewer() {
  const filteredLogs = logData.data || []

  return (
    <div class='flex flex-col h-full min-h-0'>
      <div class='flex-1 min-h-0 overflow-hidden'>
        <div class='w-full overflow-x-auto overflow-y-auto h-full'>
          <table class='table table-zebra w-full'>
            <thead class='sticky top-0 bg-base-100 shadow-sm'>
              <tr class='border-b border-base-300'>
                {logThreads.map((header) => (
                  <th
                    key={header}
                    class='text-left font-semibold text-base-content/70 whitespace-nowrap min-w-[8rem] max-w-[20rem]'
                  >
                    {header}
                  </th>
                ))}
                <th class='text-left font-semibold text-base-content/70 w-20 max-w-[5rem]'>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const serverityNum = log.severity_number
                const severity = (serverityNum < 9)
                  ? 'DEBUG'
                  : (serverityNum < 13)
                  ? 'INFO'
                  : (serverityNum < 17)
                  ? 'WARN'
                  : (serverityNum < 21)
                  ? 'ERROR'
                  : 'FATAL'
                const conf = severityConfig[
                  severity as keyof typeof severityConfig
                ]
                const SeverityIcon = conf?.icon || Info
                const severityColor = conf?.color || 'text-base-content'
                const severityBg = conf?.bg || 'bg-base-300/10'
                const timestamp = new Date(log.timestamp)

                return (
                  <tr
                    key={log.id}
                    class='hover:bg-base-200/50 border-b border-base-300/50'
                  >
                    <td class='p-0 pl-1 font-mono text-xs text-base-content/70 tabular-nums max-w-[12rem]'>
                      <div class='flex items-center gap-2'>
                        <Clock class='w-3 h-3 shrink-0' />
                        <span
                          class='truncate block'
                          title={String(timestamp.getTime())}
                        >
                          {safeFormatTimestamp(timestamp)}
                        </span>
                      </div>
                    </td>
                    <td class='p-0 max-w-[10rem]'>
                      <div
                        class={`badge badge-outline badge-sm ${severityColor} ${severityBg} border-current/20`}
                        title={`severity: ${serverityNum}`}
                      >
                        <SeverityIcon class='w-3 h-3 mr-1' />
                        {severity}
                      </div>
                    </td>
                    <td class='p-0 min-w-[12rem] max-w-[20rem]'>
                      <div class='flex flex-col gap-1'>
                        <span
                          class='text-sm text-base-content font-medium truncate'
                          title={log.event_name}
                        >
                          {log.event_name}
                        </span>
                        {log.body && (
                          <span
                            class='text-xs text-base-content/50 truncate'
                            title={log.body}
                          >
                            {log.body}
                          </span>
                        )}
                      </div>
                    </td>
                    <td class='p-0 max-w-[12rem] hidden md:table-cell'>
                      <Hex128 hex={log.trace_id} type='trace' />
                    </td>
                    <td class='p-0 max-w-[12rem] hidden md:table-cell'>
                      <Hex128 hex={log.span_id} type='span' />
                    </td>
                    <td class='p-0 text-xs text-base-content/60 hidden lg:table-cell min-w-[12rem] max-w-[16rem]'>
                      <code
                        class='font-mono block overflow-hidden text-ellipsis whitespace-nowrap'
                        title={JSON.stringify(log.attributes ?? {})}
                      >
                        {JSON.stringify(log.attributes ?? {})}
                      </code>
                    </td>
                    <td class='p-0 align-middle'>
                      <div class='flex items-center gap-1'>
                        <button
                          type='button'
                          class='btn btn-ghost btn-xs'
                          aria-label='Toggle details'
                        >
                          <Eye class='w-4 h-4' />
                        </button>
                        <button
                          type='button'
                          class='btn btn-ghost btn-xs'
                          aria-label='More actions'
                        >
                          <MoreHorizontal class='w-4 h-4' />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredLogs.length === 0 && (
        <div class='px-4 sm:px-6 py-8 text-center'>
          <div class='flex flex-col items-center gap-4'>
            <Search class='w-12 h-12 text-base-content/50' />
            <div>
              <h3 class='text-lg font-medium text-base-content'>
                No logs found
              </h3>
              <p class='text-base-content/70'>
                Try adjusting your search criteria or time range
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ComingSoon = ({ title }: { title: string }) => (
  <div class='p-4'>
    <h3 class='text-lg font-semibold mb-4'>{title}</h3>
    <p>This feature is coming soon! 🚀</p>
  </div>
)

type DrawerTab = 'history' | 'insert'
const drawerViews: Record<DrawerTab, JSX.Element> = {
  history: <QueryHistory />,
  insert: <ComingSoon title='Insert Row' />,
} as const

const Drawer = () => (
  <div class='drawer drawer-end'>
    <input
      id='drawer-right'
      type='checkbox'
      class='drawer-toggle'
      checked={url.params.drawer !== null}
      onChange={(e) => {
        if (!e.currentTarget.checked) {
          navigate({ params: { drawer: null }, replace: true })
        }
      }}
    />
    <div class='drawer-side'>
      <label
        for='drawer-right'
        aria-label='close sidebar'
        class='drawer-overlay'
      >
      </label>
      <div class='bg-base-200 text-base-content min-h-full w-96 flex flex-col'>
        <div class='flex-1 overflow-hidden'>
          <div class='drawer-view' data-view='history'>
            {drawerViews[url.params.drawer as DrawerTab] || (
              <div class='p-4'>
                <h3 class='text-lg font-semibold mb-4'>No view selected</h3>
                <p>Please select a view from the sidebar.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
)

const schemaPanel = <SchemaPanel />
const TabViews = {
  tables: (
    <div class='flex flex-1 h-full'>
      {schemaPanel}
      <DataTable />
    </div>
  ),
  queries: (
    <div class='flex flex-1 h-full'>
      {schemaPanel}
      <QueryEditor />
    </div>
  ),
  logs: <LogsViewer />,
}

export const DeploymentPage = () => {
  const tab = (url.params.tab as 'tables' | 'queries' | 'logs') || 'tables'
  const view = TabViews[tab]
  if (!view) {
    navigate({ params: { tab: 'tables' }, replace: true })
  }
  return (
    <div class='h-screen flex flex-col'>
      <Header />
      <div class='flex flex-1 min-h-0 pb-15'>
        <main class='flex-1 flex flex-col h-full'>
          <TabNavigation activeTab={tab} />
          <section class='flex-1 h-full overflow-hidden'>
            <div class='h-full bg-base-100 border border-base-300 overflow-hidden flex flex-col lg:flex'>
              {view}
            </div>
          </section>
        </main>
      </div>
      <Drawer />
    </div>
  )
}
