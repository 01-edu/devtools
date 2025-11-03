import { A, navigate, url } from '../lib/router.tsx'
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
  Info,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Table,
  XCircle,
} from 'lucide-preact'
import { deployments, sidebarItems } from './ProjectPage.tsx'
import {
  FilterMenu,
  parseFilters,
  parseSort,
  SortMenu,
} from '../components/Filtre.tsx'
import { effect, Signal } from '@preact/signals'
import { api } from '../lib/api.ts'
import { QueryHistory, QueryHistoryItem } from '../components/QueryHistory.tsx'

import { JSX } from 'preact'

type AnyRecord = Record<string, unknown>

// API signals for schema and table data
const schema = api['GET/api/deployment/schema'].signal()

const comparators = {
  'eq': '=',
  'neq': '!=',
  'lt': '<',
  'lte': '<=',
  'gt': '>',
  'gte': '>=',
  'like': 'LIKE',
  'ilike': 'ILIKE',
} as const

const tableData = api['POST/api/deployment/table/data'].signal()
const querier = api['GET/api/deployment/query'].signal()
export const queriesHistory = new Signal<Record<string, QueryHistoryItem>>(
  JSON.parse(localStorage.getItem('saved_queries') || '{}'),
)
type Order = 'ASC' | 'DESC'

queriesHistory.subscribe((val) => {
  localStorage.setItem('saved_queries', JSON.stringify(val))
})

// Effect to fetch schema when deployment URL changes
effect(() => {
  const dep = url.params.dep
  if (dep) {
    schema.fetch({ url: dep })
  }
})

const pageSize = 50
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

export const onRun = (query: string) => {
  if (querier.pending) return
  const { dep, tab } = url.params
  if (dep && tab === 'queries' && query) {
    querier.fetch({ deployment: dep, sql: query })
  }
}

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

export function QueryEditor() {
  const query = url.params.q || ''

  return (
    <div class='flex flex-col h-full min-h-0 gap-4'>
      <div class='flex-1 min-h-0 overflow-hidden'>
        <div class='relative h-full'>
          <div class='absolute inset-y-0 left-0 w-10 select-none bg-base-200/40 overflow-hidden border-r border-base-300'>
            <div class='m-0 px-2 py-2 text-xs font-mono text-base-content/50 leading-6 text-right'>
              {Array(Math.max(1, (query.match(/\n/g)?.length ?? 0) + 1))
                .keys().map((i) => <div key={i}>{i + 1}</div>).toArray()}
            </div>
          </div>

          <textarea
            value={query}
            onInput={(e) => {
              const v = (e.target as HTMLTextAreaElement).value
              navigate({ params: { q: v }, replace: true })
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                const q = url.params.q
                if (q) {
                  onRun(q)
                }
              }
            }}
            class='textarea w-full h-full font-mono text-sm leading-6 pl-12 pr-3 py-3 bg-base-100 border-base-300 focus:outline-none focus:ring-0 focus:shadow-none focus:border-primary resize-none'
            placeholder='-- Write SQL here. Press Ctrl+Enter to run'
            aria-label='SQL editor'
          />
        </div>
      </div>

      <div class='bg-base-100 border-t border-base-300 px-4 sm:px-6 py-3 shrink-0'>
        <div class='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
          <div class='flex items-center gap-3'>
            <h2 class='text-sm sm:text-base font-medium'>Results</h2>
            <span class='text-xs text-base-content/60'>
              {querier.pending
                ? 'Running…'
                : `${querier.data?.rows.length ?? 0} rows`}
            </span>
          </div>
          <div class='text-xs text-base-content/60 tabular-nums'>
            Query took {querier.data?.duration.toFixed(2) ?? 0} seconds.
          </div>
        </div>
      </div>

      <div class='flex-1 min-h-0 overflow-hidden'>
        <DataTable />
      </div>
    </div>
  )
}

export function DataTable() {
  const tab = url.params.tab
  const data = tab === 'tables'
    ? tableData.data?.rows || []
    : tab === 'queries'
    ? querier.data?.rows || []
    : []
  const columns = Object.keys(data[0] || {})
  const rows = data ?? []
  const totalPages = Math.max(
    1,
    Math.ceil((tableData.data?.totalRows || 0) / pageSize),
  )
  const tpage = Number(url.params.tpage) || 0
  const page = tpage + 1
  const hasNext = page < totalPages
  const hasPrev = page > 1

  return (
    <div class='flex flex-col h-full min-h-0'>
      <div class='flex-1 min-h-0 overflow-hidden'>
        <div class='w-full overflow-x-auto overflow-y-auto h-full'>
          <table class='table table-zebra w-full'>
            <thead class='sticky top-0 bg-base-100 shadow-sm'>
              <tr>
                <th class='sticky left-0 bg-base-100 w-16 min-w-[3rem] max-w-[4rem]'>
                  <span class='text-xs font-semibold text-base-content/70'>
                    #
                  </span>
                </th>
                {columns.length > 0
                  ? columns.map((key) => (
                    <th
                      key={key}
                      class='whitespace-nowrap min-w-[8rem] max-w-[20rem] font-semibold text-base-content/70'
                      title={key}
                    >
                      <span class='truncate block'>{key}</span>
                    </th>
                  ))
                  : <th class='text-left'>No columns</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    class='p-6 text-base-content/60 text-center'
                    colSpan={Math.max(2, columns.length + 1)}
                  >
                    <div class='flex flex-col items-center gap-2 py-4'>
                      <Table class='h-12 w-12 text-base-content/30' />
                      <span class='text-sm'>No results to display</span>
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((row, index) => (
                <tr
                  key={index}
                  class='hover:bg-base-200/50'
                >
                  <td class='sticky left-0 bg-base-100 tabular-nums font-medium text-xs text-base-content/60 w-16 max-w-[4rem]'>
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  {columns.map((key, i) => {
                    const value = (row as AnyRecord)[key]
                    const isObj = typeof value === 'object' && value !== null
                    const stringValue = isObj
                      ? JSON.stringify(value)
                      : String(value ?? '')
                    const isTooLong = stringValue.length > 100

                    return (
                      <td
                        key={i}
                        class='align-top min-w-[8rem] max-w-[20rem]'
                        title={isTooLong ? stringValue : undefined}
                      >
                        {isObj
                          ? (
                            <code class='font-mono text-xs text-base-content/70 block overflow-hidden text-ellipsis whitespace-nowrap'>
                              {stringValue}
                            </code>
                          )
                          : (
                            <span class='block overflow-hidden text-ellipsis whitespace-nowrap text-sm'>
                              {stringValue}
                            </span>
                          )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {tab === 'tables' && (
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
              <div class='join'>
                <A
                  params={{ tpage: tpage - 1 }}
                  class={`join-item btn btn-sm ${
                    hasPrev ? '' : 'btn-disabled'
                  }`}
                  aria-label='Previous page'
                >
                  ‹
                </A>
                <A
                  params={{ tpage: tpage + 1 }}
                  class={`join-item btn btn-sm ${
                    hasNext ? '' : 'btn-disabled'
                  }`}
                  aria-label='Next page'
                >
                  ›
                </A>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function Header() {
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

export function LeftPanel() {
  const dep = url.params.dep

  // Group tables by schema name
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
                      <A
                        params={{
                          tab: 'tables',
                          table: table.table,
                          ft: null,
                          st: null,
                          qt: null,
                        }}
                        class='flex items-center gap-2 p-2 hover:bg-base-200 cursor-pointer w-full text-left transition-colors'
                      >
                        <A
                          params={{ expanded: isExpanded ? null : table.table }}
                          class='shrink-0'
                        >
                          {isExpanded
                            ? (
                              <ChevronDown class='h-4 w-4 text-base-content/60' />
                            )
                            : (
                              <ChevronRight class='h-4 w-4 text-base-content/60' />
                            )}
                        </A>
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

export function TabNavigation({
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
                ? () => onRun(url.params.q || '')
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

const severityConfig = {
  DEBUG: { icon: Bug, color: 'text-info', bg: 'bg-info/10' },
  INFO: { icon: Info, color: 'text-info', bg: 'bg-info/10' },
  WARN: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  ERROR: { icon: XCircle, color: 'text-error', bg: 'bg-error/10' },
  FATAL: { icon: AlertCircle, color: 'text-error', bg: 'bg-error/10' },
} as const

const safeFormatTimestamp = (timestamp: number) => {
  return new Date(timestamp).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

const logThreads = [
  'Timestamp',
  'Severity',
  'Event',
  'Trace',
  'Span',
  'Attributes',
] as const

export function LogsViewer() {
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

                return (
                  <tr
                    key={log.id}
                    class='hover:bg-base-200/50 border-b border-base-300/50'
                  >
                    <td class='font-mono text-xs text-base-content/70 tabular-nums max-w-[12rem]'>
                      <div class='flex items-center gap-2'>
                        <Clock class='w-3 h-3 shrink-0' />
                        <span
                          class='truncate block'
                          title={safeFormatTimestamp(log.timestamp)}
                        >
                          {safeFormatTimestamp(log.timestamp)}
                        </span>
                      </div>
                    </td>
                    <td class='max-w-[10rem]'>
                      <div
                        class={`badge badge-outline badge-sm ${severityColor} ${severityBg} border-current/20`}
                      >
                        <SeverityIcon class='w-3 h-3 mr-1' />
                        {severity}
                      </div>
                    </td>
                    <td class='min-w-[12rem] max-w-[20rem]'>
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
                    <td class='font-mono text-xs text-base-content/50 max-w-[12rem] hidden md:table-cell'>
                      <span class='block truncate' title={log.trace_id}>
                        {log.trace_id}
                      </span>
                    </td>
                    <td class='font-mono text-xs text-base-content/50 max-w-[12rem] hidden md:table-cell'>
                      <span class='block truncate' title={log.span_id}>
                        {log.span_id}
                      </span>
                    </td>
                    <td class='text-xs text-base-content/60 hidden lg:table-cell min-w-[12rem] max-w-[16rem]'>
                      <code
                        class='font-mono block overflow-hidden text-ellipsis whitespace-nowrap'
                        title={JSON.stringify(log.attributes ?? {})}
                      >
                        {JSON.stringify(log.attributes ?? {})}
                      </code>
                    </td>
                    <td class='align-middle'>
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

const CommingSoon = ({ title }: { title: string }) => (
  <div class='p-4'>
    <h3 class='text-lg font-semibold mb-4'>{title}</h3>
    <p>This feature is coming soon!</p>
  </div>
)

type DrawerTab = 'history' | 'insert'
const drawerViews: Record<DrawerTab, JSX.Element> = {
  history: <QueryHistory />,
  insert: <CommingSoon title='Insert Row' />,
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
        htmlFor='drawer-right'
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

const TabViews = {
  tables: <DataTable />,
  queries: <QueryEditor />,
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
        <LeftPanel />
        <main class='flex-1 flex flex-col h-full'>
          <TabNavigation activeTab={tab} />
          <section class='flex-1 h-full overflow-hidden'>
            <div class='h-full bg-base-100 border border-base-300 overflow-hidden flex flex-col  hidden lg:flex'>
              {view}
            </div>
          </section>
        </main>
      </div>
      <Drawer />
    </div>
  )
}
