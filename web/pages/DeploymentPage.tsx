import { A, navigate, url } from '@01edu/signal-router'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart,
  BarChart2,
  Bug,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns,
  Cpu,
  Database,
  Download,
  FileText,
  Hash,
  Info,
  Link2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Table,
  Timer,
  XCircle,
} from 'lucide-preact'
import {
  FilterMenu,
  parseFilters,
  parseSort,
  SortMenu,
  toggleSort,
} from '../components/Filtre.tsx'
import { computed, effect, Signal, untracked } from '@preact/signals'
import { api, type ApiOutput } from '../lib/api.ts'
import { QueryHistory } from '../components/QueryHistory.tsx'
import { DialogModal } from '../components/Dialog.tsx'

import type { ComponentChildren } from 'preact'
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
export const rowDetailsData = api['POST/api/deployment/table/data'].signal()
export const logDetailsData = api['POST/api/deployment/logs'].signal()
export const metricsData = api['GET/api/deployment/metrics-sql'].signal()

const toastSignal = new Signal<
  { message: string; type: 'info' | 'error' } | null
>(
  null,
)

function toast(message: string, type: 'info' | 'error' = 'info') {
  toastSignal.value = { message, type }
  setTimeout(() => (toastSignal.value = null), 3000)
}

const Toast = () => {
  if (!toastSignal.value) return null
  return (
    <div class='fixed bottom-4 right-4 bg-base-200 shadow-lg rounded-lg p-4 text-sm flex items-center gap-3 z-[100] border border-base-300'>
      {toastSignal.value.type === 'error' && (
        <AlertTriangle class='w-5 h-5 text-error' />
      )}
      <span class='text-base-content'>{toastSignal.value.message}</span>
    </div>
  )
}

// Effect to fetch schema when deployment URL changes
effect(() => {
  const dep = url.params.dep
  dep && schema.fetch({ url: dep })
})

const tabNames = ['tables', 'queries', 'logs', 'metrics'] as const
type TabName = (typeof tabNames)[number]

const activeTab = computed(() => {
  const tab = url.params.tab as TabName
  return tabNames.includes(tab) ? tab : 'tables'
})

effect(() => {
  activeTab.value // clear expanded when params.tab change
  untracked(() => navigate({ params: { expanded: null }, replace: true }))
})

async function sha(message: string) {
  const data = new TextEncoder().encode(message)
  const buff = await crypto.subtle.digest('SHA-1', data)
  return new Uint8Array(buff).toHex()
}

const queryHash = new Signal<string>('')
effect(() => {
  const query = (url.params.q || '').trim()
  if (query) {
    sha(query).then((hash) => queryHash.value = hash)
  } else {
    queryHash.value = ''
  }
})

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
          <div class='w-2 h-2 bg-primary rounded-full' />
          <span class='text-xs text-base-content/60'>Running…</span>
        </div>
      )
      : (querier.data?.rows.length ?? 0) > 0
      ? (
        <span class='text-xs text-base-content/60'>
          {querier.data?.rows.length} rows
        </span>
      )
      : null}
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
        <div class='flex items-center gap-3'>
          <ExecutionTime />
          <button
            onClick={onDownload}
            type='button'
            disabled={!querier.data?.rows?.length}
            class='btn btn-ghost btn-xs'
            title='Download results as JSON'
          >
            <Download class='h-4 w-4' />
            <span class='hidden sm:inline'>Download</span>
          </button>
        </div>
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
  <td class='sticky left-0 bg-base-100 tabular-nums font-medium text-xs text-base-content/60 w-10 min-w-[2.5rem] p-0 pl-1 border-r border-base-300/50 text-left'>
    {(Number(url.params.tpage) || 0) * pageSize + index + 1}
  </td>
)

const TableCell = ({ value }: { value: unknown }) => {
  const isObj = typeof value === 'object' && value !== null
  const stringValue = isObj ? JSON.stringify(value) : String(value ?? '')
  const isTooLong = stringValue.length > 100

  if (value === null || value === undefined || value === '') {
    return (
      <span class='text-sm text-base-content/30 italic select-none text-left block w-full'>
        null
      </span>
    )
  }

  if (isObj) {
    return (
      <code
        class='font-mono text-sm text-base-content/70 block overflow-hidden text-ellipsis whitespace-nowrap max-w-md text-left w-full'
        title={isTooLong ? stringValue : undefined}
      >
        {stringValue}
      </code>
    )
  }

  return (
    <span
      class='block overflow-hidden text-ellipsis whitespace-nowrap text-sm max-w-md text-left w-full'
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
) => {
  const tableName = url.params.table || schema.data?.tables?.[0]?.table
  const tableDef = schema.data?.tables?.find((t) => t.table === tableName)
  const pk = tableDef?.columns?.[0]?.name
  const rowId = pk ? String(row[pk]) : undefined

  return (
    <A
      params={{ drawer: 'view-row', 'row-id': rowId }}
      class='contents'
    >
      <tr class='hover:bg-base-200/50 cursor-pointer transition-colors border-b border-base-200/50 last:border-b-0'>
        <RowNumberCell index={index} />
        {columns.map((key) => (
          <td class='align-top min-w-[6rem] p-0 pl-1 border-r border-base-300/30 font-normal text-left'>
            <TableCell value={row[key]} />
          </td>
        ))}
      </tr>
    </A>
  )
}

const TableHeader = (
  { columns }: { columns: (string | { key: string; label: string })[] },
) => {
  const prefix = url.params.tab === 'tables' ? 't' : 'l'
  const sorts = parseSort(prefix).filter((s) => s.key)

  return (
    <thead class='sticky top-0 bg-base-200/90 backdrop-blur-sm shadow-sm z-10 border-b-2 border-base-300'>
      <tr>
        <th class='sticky left-0 bg-base-200 w-10 min-w-[2.5rem] p-0 pl-1 border-r border-base-300/50 text-left'>
          <span class='text-xs font-bold text-base-content/80 uppercase tracking-wider'>
            #
          </span>
        </th>
        {columns.length > 0
          ? (
            columns.map((col) => {
              const key = typeof col === 'string' ? col : col.key
              const label = typeof col === 'string' ? col : col.label
              const sort = sorts.find((s) => s.key === key)
              return (
                <th
                  key={key}
                  onClick={() => toggleSort(prefix, key)}
                  class='whitespace-nowrap min-w-[6rem] p-0 pl-1 font-bold text-xs text-base-content/80 cursor-pointer hover:bg-base-300/50 border-r border-base-300/50 transition-colors group text-left'
                  title={`Sort by ${label}`}
                >
                  <div class='flex items-center gap-2 shrink-0'>
                    <span class='truncate flex-1 uppercase tracking-wider'>
                      {label}
                    </span>
                    <div class='shrink-0 w-4 h-4 flex items-center justify-center'>
                      {sort
                        ? (
                          sort.dir === 'asc'
                            ? <ArrowUp class='h-3 w-3 text-primary' />
                            : <ArrowDown class='h-3 w-3 text-primary' />
                        )
                        : (
                          <ArrowUp class='h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity' />
                        )}
                    </div>
                  </div>
                </th>
              )
            })
          )
          : (
            <th class='text-left text-sm px-4 py-2 uppercase tracking-wider'>
              No columns
            </th>
          )}
      </tr>
    </thead>
  )
}

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
  let columns = Object.keys(rows[0] || {})

  // If in tables view, use schema columns first
  if (url.params.tab === 'tables') {
    const tableName = url.params.table || schema.data?.tables?.[0]?.table
    const tableDef = schema.data?.tables?.find((t) => t.table === tableName)

    if (tableDef?.columns) {
      const schemaColumns = tableDef.columns.map((c) => c.name)
      // Add any extra columns found in rows that aren't in schema (e.g. virtual columns)
      const extraColumns = columns.filter((c) => !schemaColumns.includes(c))
      columns = [...schemaColumns, ...extraColumns]
    }
  }
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
  const isPending = tab === 'tables' ? tableData.pending : querier.pending

  const rows = tab === 'tables'
    ? tableData.data?.rows || []
    : tab === 'queries'
    ? querier.data?.rows || []
    : []

  return (
    <div class='flex flex-col h-full min-h-0 grow-1 relative'>
      {!!isPending && (
        <div class='absolute top-0 left-0 right-0 h-0.5 z-20 overflow-hidden bg-base-300'>
          <div class='h-full bg-primary w-1/3'></div>
        </div>
      )}
      <div class='flex-1 min-h-0 overflow-hidden'>
        <div
          class={`w-full overflow-x-auto overflow-y-auto h-full transition-all duration-200 ease-in-out ${
            isPending ? 'opacity-60 scale-[0.998]' : 'opacity-100 scale-100'
          }`}
        >
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
                  <RefreshCw class='h-3 w-3' />
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

        {!!schema.pending && (
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

const TabButton = (
  { tabName }: { tabName: 'tables' | 'queries' | 'logs' | 'metrics' },
) => (
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

function TabNavigation() {
  // Get column names from the currently selected table for tables tab
  const tab = activeTab.value
  const selectedTableName = url.params.table || schema.data?.tables?.[0]?.table
  const selectedTable = schema.data?.tables?.find((t) =>
    t.table === selectedTableName
  )
  const tableColumnNames = selectedTable?.columns.map((c) => c.name) || []
  const filterKeyOptions = tab === 'tables' ? tableColumnNames : [
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
          <TabButton tabName='metrics' />
        </div>

        <div class='flex flex-wrap items-center gap-2 shrink-0'>
          {(tab === 'tables' || tab === 'logs') && (
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
          {tab !== 'logs' && (
            <A
              params={{ drawer: tab === 'tables' ? 'insert' : null }}
              onClick={tab === 'queries'
                ? () => runQuery(url.params.q || '')
                : undefined}
              class='btn btn-primary btn-sm'
            >
              {tab === 'queries'
                ? <Play class='h-4 w-4' />
                : <Plus class='h-4 w-4' />}
              <span class='hidden sm:inline'>
                {tab === 'queries' ? 'Run query' : 'Insert row'}
              </span>
            </A>
          )}
          {tab !== 'queries' && tab !== 'metrics' && (
            <>
              <FilterMenu filterKeyOptions={filterKeyOptions} tag={tab} />
              <SortMenu sortKeyOptions={filterKeyOptions} tag={tab} />
            </>
          )}
          {tab === 'queries' && (
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const logData = api['POST/api/deployment/logs'].signal()
effect(() => {
  const { dep, lq, sbi } = url.params
  if (dep && sbi === 'deployment') {
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

const safeFormatTimestamp = (timestamp: Date) => {
  // If timestamp is close to epoch (1970), assume it's in seconds and convert to ms
  const time = timestamp.getTime()
  const correctTime = time < 1000000000000 ? time * 1000 : time // 1e12 ms is roughly year 2001, 1e10 sec is year 2286
  return new Date(correctTime).toLocaleString('en-UK', dateFmtConfig)
    .split(', ').reverse().join(' ')
}

// Derive severity text from severity number (matches DB schema)
const getSeverityText = (
  severityNumber: number,
  existingText?: string | null,
): string => {
  if (existingText) return existingText
  if (severityNumber > 4 && severityNumber <= 8) return 'DEBUG'
  if (severityNumber > 8 && severityNumber <= 12) return 'INFO'
  if (severityNumber > 12 && severityNumber <= 16) return 'WARN'
  if (severityNumber > 20 && severityNumber <= 24) return 'FATAL'
  return 'ERROR'
}

// Reusable copy button with hover reveal
const CopyButton = ({ text }: { text: string }) => (
  <button
    type='button'
    class='btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity'
    title='Copy'
    onClick={() => navigator.clipboard.writeText(text)}
  >
    <Save class='h-3 w-3' />
  </button>
)

// Reusable info block for key-value display
const InfoBlock = (
  { label, value, mono = false, copy = false }: {
    label: string
    value?: string | number | null
    mono?: boolean
    copy?: boolean
  },
) => {
  const displayValue = value == null ? '-' : String(value)
  return (
    <div class='group bg-base-100 rounded-lg p-3 border border-base-200'>
      <div class='text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-1'>
        {label}
      </div>
      <div class='flex items-center justify-between gap-2 overflow-hidden'>
        <div
          class={`text-sm break-all ${
            mono ? 'font-mono text-xs' : 'font-medium'
          }`}
          title={displayValue}
        >
          {displayValue}
        </div>
        {copy && displayValue !== '-' && <CopyButton text={displayValue} />}
      </div>
    </div>
  )
}

// Recursive JSON value renderer with syntax highlighting
const JsonValue = ({ value }: { value: unknown }) => {
  if (typeof value === 'object' && value !== null) {
    if (Object.keys(value).length === 0) {
      return <span class='text-base-content/40 italic'>empty object</span>
    }
    return (
      <div class='pl-3 border-l-2 border-base-300 space-y-1 my-1'>
        {Object.entries(value).map(([k, v]) => (
          <div key={k} class='text-sm'>
            <span class='font-medium opacity-70 text-xs text-primary'>
              {k}:
            </span>
            <JsonValue value={v} />
          </div>
        ))}
      </div>
    )
  }
  const valStr = String(value)
  const isNumber = !isNaN(Number(value)) && value !== ''
  const isBool = valStr === 'true' || valStr === 'false'
  const colorClass = isNumber
    ? 'text-blue-500'
    : isBool
    ? 'text-secondary'
    : 'text-base-content'
  return <span class={`font-mono break-all ${colorClass}`}>{valStr}</span>
}

// Hex128 ID block with oklch colors
const Hex128Block = (
  { hex, type }: { hex: string; type: 'trace' | 'span' },
) => {
  const { hue, value } = parseHex128(hex)
  const Icon = type === 'trace' ? Link2 : Hash
  const label = type === 'trace' ? 'Trace ID' : 'Span ID'

  return (
    <div
      class='group rounded-lg p-3 border'
      style={{
        color: `oklch(0.93 0.15 ${hue})`,
        backgroundColor: `oklch(0.25 0.01 ${hue})`,
        borderColor: `oklch(0.4 0.05 ${hue})`,
      }}
    >
      <div class='flex items-center gap-2 mb-2'>
        <Icon class='w-3 h-3' />
        <div class='text-[10px] font-bold uppercase tracking-wider'>
          {label}
        </div>
      </div>
      <div class='flex items-center justify-between gap-2 overflow-hidden'>
        <div class='font-mono text-sm font-semibold break-all' title={hex}>
          {hex}
        </div>
        <CopyButton text={hex} />
      </div>
      <div class='text-[9px] opacity-40 mt-1 font-mono'>raw: {value}</div>
    </div>
  )
}

// Severity block with icon and colors
const SeverityBlock = (
  { severityNumber, severityText }: {
    severityNumber: number
    severityText?: string | null
  },
) => {
  const text = getSeverityText(severityNumber, severityText)
  const config = severityConfig[text as keyof typeof severityConfig]
  const Icon = config?.icon || Info

  return (
    <div
      class={`group rounded-lg p-3 border ${config?.bg || 'bg-base-100'} ${
        config?.color || ''
      }`}
    >
      <div class='text-[10px] font-bold uppercase tracking-wider mb-2 opacity-60'>
        Severity
      </div>
      <div class='flex items-center gap-3'>
        <Icon class='w-5 h-5' />
        <div>
          <div class='font-bold text-lg'>{text}</div>
          <div class='text-xs opacity-60 font-mono'>Level {severityNumber}</div>
        </div>
      </div>
    </div>
  )
}

// Body block for log message
const BodyBlock = ({ body }: { body: string }) => (
  <div class='group bg-base-100 rounded-lg p-3 border border-base-200'>
    <div class='flex items-center justify-between mb-2'>
      <div class='text-[10px] font-bold text-base-content/40 uppercase tracking-wider flex items-center gap-1'>
        <FileText class='h-3 w-3' /> Body
      </div>
      <CopyButton text={body} />
    </div>
    <pre class='text-sm font-mono whitespace-pre-wrap break-all bg-base-200/50 rounded p-2'>{body}</pre>
  </div>
)

// Attributes block for JSON display
const AttributesBlock = (
  { attributes }: { attributes: Record<string, unknown> },
) => (
  <div class='group bg-base-100 rounded-lg p-3 border border-base-200'>
    <div class='text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-2 flex items-center gap-1'>
      <Hash class='h-3 w-3' /> Attributes
    </div>
    <div class='bg-base-200/30 rounded p-2 overflow-x-auto'>
      <JsonValue value={attributes} />
    </div>
  </div>
)

const logThreads = [
  { label: 'Timestamp', key: 'timestamp' },
  { label: 'Severity', key: 'severity_number' },
  { label: 'Instance', key: 'service_instance_id' },
  { label: 'Event', key: 'event_name' },
  { label: 'Version', key: 'service_version' },
  { label: 'Trace', key: 'trace_id' },
  { label: 'Span', key: 'span_id' },
  { label: 'Attributes', key: 'attributes' },
] as const

const Hex128 = ({ hex, type }: { hex: string; type: 'trace' | 'span' }) => {
  const { hue, short, value } = parseHex128(hex)
  const Icon = type === 'trace' ? Link2 : Hash

  return (
    <A
      class='badge badge-outline text-xs h-6 min-h-[1.5rem] px-1.5 border-current/20'
      title={`${type}: ${hex} (${value})`}
      params={{ fl: `${type}_id,eq,${hex}` }}
      style={{
        color: `oklch(0.93 0.15 ${hue})`,
        backgroundColor: `oklch(0.25 0.01 ${hue})`,
      }}
    >
      <Icon class='w-3 h-3 mr-1' />
      <span class='uppercase truncate'>{short}</span>
    </A>
  )
}

function LogsViewer() {
  const filteredLogs = logData.data || []
  const isPending = logData.pending

  return (
    <div class='flex flex-col h-full min-h-0 relative'>
      {!!isPending && (
        <div class='absolute top-0 left-0 right-0 h-0.5 z-20 overflow-hidden bg-base-300'>
          <div class='h-full bg-primary animate-progress origin-left'></div>
        </div>
      )}
      <div class='flex-1 min-h-0 overflow-hidden'>
        <div
          class={`w-full overflow-x-auto overflow-y-auto h-full transition-all duration-300 ease-in-out pb-4 ${
            isPending
              ? 'opacity-50 grayscale-[0.5] scale-[0.995]'
              : 'opacity-100 scale-100'
          }`}
        >
          <table class='table table-zebra w-full'>
            <TableHeader
              columns={logThreads as unknown as {
                key: string
                label: string
              }[]}
            />
            <tbody>
              {filteredLogs.map((log) => {
                const serverityNum = log.severity_number
                const severity = getSeverityText(
                  serverityNum,
                  log.severity_text,
                )
                const conf = severityConfig[
                  severity as keyof typeof severityConfig
                ]
                const SeverityIcon = conf?.icon || Info
                const severityColor = conf?.color || 'text-base-content'
                const severityBg = conf?.bg || 'bg-base-300/10'
                const timestamp = new Date(log.timestamp)

                return (
                  <A
                    params={{ drawer: 'view-log', 'log-id': log.id }}
                    class='contents'
                  >
                    <tr
                      key={log.id}
                      class='hover:bg-base-200/50 border-b border-base-300/50 cursor-pointer transition-colors'
                    >
                      <RowNumberCell index={logData.data?.indexOf(log) ?? 0} />
                      <td class='p-0 pl-1 font-mono text-xs text-base-content/70 tabular-nums w-44 shrink-0 border-r border-base-300/30 text-left'>
                        <div class='flex items-center gap-2 text-xs'>
                          <Clock class='w-3 h-3 shrink-0 opacity-50' />
                          <span
                            class='truncate block'
                            title={String(timestamp.getTime())}
                          >
                            {safeFormatTimestamp(timestamp)}
                          </span>
                        </div>
                      </td>
                      <td class='p-0 pl-1 w-24 shrink-0 text-left border-r border-base-300/30'>
                        <div
                          class={`badge badge-outline text-xs uppercase font-bold h-5 min-h-[1.25rem] px-2 ${severityColor} ${severityBg} border-current/20`}
                          title={`severity: ${serverityNum}`}
                        >
                          <SeverityIcon class='w-2.5 h-2.5 mr-1' />
                          {severity}
                        </div>
                      </td>
                      <td class='p-0 pl-1 w-32 shrink-0 text-left border-r border-base-300/30 text-xs text-base-content/60 font-mono truncate uppercase'>
                        {log.service_instance_id || '-'}
                      </td>
                      <td class='p-0 pl-1 min-w-[12rem] max-w-lg text-left border-r border-base-300/30'>
                        <div class='flex flex-col leading-tight py-0.5'>
                          <span
                            class='text-sm text-base-content font-medium truncate block'
                            title={log.event_name}
                          >
                            {log.event_name}
                          </span>
                          {log.body && (
                            <span
                              class='text-xs text-base-content/50 truncate block'
                              title={log.body}
                            >
                              {log.body}
                            </span>
                          )}
                        </div>
                      </td>
                      <td class='p-0 pl-1 w-24 shrink-0 text-left border-r border-base-300/30 text-xs text-base-content/60 font-mono truncate uppercase'>
                        {log.service_version || '-'}
                      </td>
                      <td class='p-0 pl-1 w-32 shrink-0 hidden lg:table-cell text-left border-r border-base-300/30'>
                        <Hex128 hex={log.trace_id} type='trace' />
                      </td>
                      <td class='p-0 pl-1 w-32 shrink-0 hidden lg:table-cell text-left border-r border-base-300/30'>
                        <Hex128 hex={log.span_id} type='span' />
                      </td>
                      <td class='p-0 pl-1 text-xs text-base-content/60 hidden xl:table-cell min-w-[10rem] max-w-lg text-left border-r border-base-300/30'>
                        <code
                          class='font-mono block overflow-hidden text-ellipsis whitespace-nowrap'
                          title={JSON.stringify(log.attributes ?? {})}
                        >
                          {JSON.stringify(log.attributes ?? {})}
                        </code>
                      </td>
                    </tr>
                  </A>
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
  metrics: <MetricsViewer />,
  // Add other tab views here as needed
} satisfies Record<TabName, ComponentChildren>

effect(() => {
  const { dep, tab } = url.params
  if (dep && tab === 'metrics') {
    metricsData.fetch({ deployment: dep })
  }
})

// ─── Metrics types ───────────────────────────────────────────────────────────

type Metric = ApiOutput['GET/api/deployment/metrics-sql'][number]
type MetricStatus = NonNullable<Metric['status']>
type MetricExplain = NonNullable<Metric['explain']>

type ExplainNode = {
  id: number
  parent: number
  detail: string
  children: ExplainNode[]
}

type ExplainTreeNodeProps = {
  node: ExplainNode
  depth?: number
  isLast?: boolean
  prefix?: string
}

type StatCellProps = {
  label: string
  value: string | number
  unit?: string
  valueClass?: string
  unitClass?: string
  width?: string
}

type MetricRowProps = { metric: Metric & { id: string } }
type StatusCountersProps = { status: MetricStatus }
type QueryPlanProps = { explain: MetricExplain }

// ─── Metrics helpers ────────────────────────────────────────────────────────

function formatDuration(ms: number): { value: string; unit: string } {
  if (ms < (1 / 1000)) return { value: (ms * 1000 ** 2).toFixed(2), unit: 'ns' }
  if (ms < 1) return { value: (ms * 1000).toFixed(2), unit: 'μs' }
  if (ms >= 1000 * 60) {
    return { value: (ms / (1000 * 60)).toFixed(2), unit: 'm' }
  }
  if (ms >= 1000) return { value: (ms / 1000).toFixed(2), unit: 's' }
  return { value: ms.toFixed(2), unit: 'ms' }
}

function formatBytes(bytes: number): { value: string; unit: string } {
  if (bytes < 1024) return { value: bytes.toFixed(2), unit: 'B' }
  if (bytes < 1024 ** 2) {
    return { value: (bytes / 1024).toFixed(2), unit: 'KB' }
  }
  if (bytes < 1024 ** 3) {
    return { value: (bytes / (1024 ** 2)).toFixed(2), unit: 'MB' }
  }
  return { value: (bytes / (1024 ** 3)).toFixed(2), unit: 'GB' }
}

type StatusProperty = { label: string; title: string; fmt?: typeof formatBytes }
const STATUS_LABELS: Record<string, StatusProperty> = {
  fullscanStep: {
    label: 'Full Scan Steps',
    title:
      'Number of steps that performed a full scan of a table or index, which is a common cause of slow queries.',
  },
  sort: {
    label: 'Sorts',
    title: 'Number of steps that performed a sort operation.',
  },
  autoindex: {
    label: 'Autoindex Steps',
    title: 'Number of steps that created an index automatically.',
  },
  vmStep: {
    label: 'VM Steps',
    title: 'Number of steps that involved virtual machine operations.',
  },
  reprepare: {
    label: 'Reprepares',
    title: 'Number of steps that reprepared a query plan.',
  },
  run: { label: 'Runs', title: 'Number of times a query was executed.' },
  filterHit: {
    label: 'Filter Hit',
    title: 'Number of times a filter condition was satisfied.',
  },
  filterMiss: {
    label: 'Filter Miss',
    title: 'Number of times a filter condition was not satisfied.',
  },
  memused: {
    label: 'Memory Used',
    title: 'The approximate number of bytes of heap memory used.',
    fmt: formatBytes,
  },
}

const sortedMetrics = new Signal<(Metric & { id: string })[]>([])

effect(() => {
  Promise.all((metricsData.data || []).map(async (metric) => {
    const id = (await sha(metric.query)).slice(0, 8)
    return { ...metric, id }
  })).then((metrics) => {
    metrics.sort((a, b) => a.duration - b.duration)
    sortedMetrics.value = metrics
  })
})

const stats = computed(() => {
  const metrics = sortedMetrics.value
  return {
    count: metrics.length,
    maxDuration: metrics[0]?.duration || 0,
    totalCalls: metrics.reduce((acc, m) => acc + (m.count || 0), 0),
    totalDuration: metrics.reduce((acc, m) => acc + (m.duration || 0), 0),
  }
})

function buildExplainTree(rows: MetricExplain): ExplainNode[] {
  const map = new Map<number, ExplainNode>()
  const roots: ExplainNode[] = []
  for (const row of rows) map.set(row.id, { ...row, children: [] })
  for (const node of map.values()) {
    const parent = map.get(node.parent)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

// ─── Fix with AI components ──────────────────────────────────────────────────

const fixQueryApi = api['POST/api/deployment/fix-query'].signal()
const analysisCache = new Signal(new Map<string, string>())

// Fetch when opening dialog for an uncached metric
effect(() => {
  const { expanded, dep, tab, dialog } = url.params
  if (!dep || tab !== 'metrics' || dialog !== 'fix-with-ai') return
  if (!expanded || analysisCache.value.has(expanded)) return
  const sorted = sortedMetrics.value
  const metric = sorted.find((m) => m.id === expanded)
  if (!metric) return
  fixQueryApi.fetch({ id: metric.id, deployment: dep, metric })
})

// Populate cache using fetchingFor — not url.params.expanded which may have changed
effect(() => {
  const data = fixQueryApi.data
  if (!data) return
  const cashe = analysisCache.peek()

  if (!cashe.has(data.id)) {
    analysisCache.value = new Map(cashe).set(
      data.id,
      data.analysis,
    )
  }
})

function AiAnalysisDialog() {
  const expanded = url.params.expanded
  const cached = expanded ? analysisCache.value.get(expanded) : undefined
  return (
    <DialogModal id='fix-with-ai' class='modal'>
      <div class='w-full max-w-2xl'>
        <h3 class='text-lg font-bold mb-4 flex items-center gap-2'>
          <Sparkles class='w-5 h-5 text-primary' />
          AI Query Optimization
        </h3>
        {!cached && fixQueryApi.pending && (
          <div class='flex flex-col items-center justify-center py-12 gap-3'>
            <span class='loading loading-spinner loading-lg text-primary' />
            <span class='text-sm text-base-content/50'>Analyzing query…</span>
          </div>
        )}
        {!cached && fixQueryApi.error && (
          <div class='alert alert-error text-sm mt-2'>
            <AlertCircle class='w-4 h-4 shrink-0' />
            <span>{fixQueryApi.error.message}</span>
          </div>
        )}
        {cached && (
          <div
            class='overflow-y-auto max-h-[65vh] text-sm leading-relaxed
              [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-1 [&_h2]:border-b [&_h2]:border-base-300 [&_h2]:pb-1
              [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:text-primary
              [&_pre]:bg-base-200 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:font-mono [&_pre]:whitespace-pre
              [&_code]:bg-base-200 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
              [&_li]:ml-5 [&_li]:text-base-content/80 [&_ul]:list-disc [&_ol]:list-decimal
              [&_p]:text-base-content/80 [&_p]:my-0.5'
            dangerouslySetInnerHTML={{ __html: cached }}
          />
        )}
      </div>
    </DialogModal>
  )
}

// ─── Metrics sub-components ─────────────────────────────────────────────────

function ExplainTreeNode(
  { node, depth = 0, isLast = true, prefix = '' }: ExplainTreeNodeProps,
) {
  const connector = depth === 0 ? '' : isLast ? '└─ ' : '├─ '
  const childPrefix = depth === 0 ? '' : prefix + (isLast ? '   ' : '│  ')
  return (
    <div>
      <div class='flex items-start gap-1 py-1'>
        {depth > 0 && (
          <span class='font-mono text-[11px] text-base-content/25 whitespace-pre shrink-0 select-none'>
            {prefix}
            {connector}
          </span>
        )}
        <span
          class={`font-mono text-[12px] leading-relaxed text-base-content/80 ${
            depth === 0 ? 'font-medium' : ''
          }`}
        >
          {node.detail}
        </span>
      </div>
      {node.children.map((child, i) => (
        <ExplainTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          isLast={i === node.children.length - 1}
          prefix={childPrefix}
        />
      ))}
    </div>
  )
}

function QueryPlan({ explain }: QueryPlanProps) {
  return (
    <div>
      <div class='text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-2 flex items-center gap-1.5'>
        <BarChart2 class='w-3.5 h-3.5' /> Query Plan
      </div>
      <div class='bg-base-100 rounded-lg border border-base-200 p-3 overflow-x-auto max-h-64 overflow-y-auto'>
        {buildExplainTree(explain).map((node) => (
          <ExplainTreeNode key={node.id} node={node} />
        ))}
      </div>
    </div>
  )
}

function StatusCounters({ status }: StatusCountersProps) {
  return (
    <div>
      <div class='text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-2 flex items-center gap-1.5'>
        <Cpu class='w-3.5 h-3.5' /> Execution Counters
      </div>
      <div class='grid grid-cols-4 gap-2'>
        {Object.entries(status).map(([key, val]) => {
          const match = STATUS_LABELS[key as keyof typeof STATUS_LABELS] ||
            { label: key }
          const { value, unit } = match.fmt?.(val) || { value: val }
          return (
            <div
              key={key}
              class='bg-base-100 rounded-lg border border-base-200 px-2.5 py-2 text-center'
            >
              <div
                class='text-[9px] font-medium text-base-content/35 uppercase tracking-wide truncate mb-0.5'
                title={match.title}
              >
                {match.label}
              </div>
              <div class='font-mono text-sm font-semibold text-base-content/75 tabular-nums'>
                {value}
                {unit && (
                  <span class='text-[9px] text-base-content/35 ml-0.5'>
                    {unit}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatCell({
  label,
  value,
  unit,
  valueClass = 'text-base-content/80',
  unitClass = 'text-base-content/30',
  width = 'w-24',
}: StatCellProps) {
  return (
    <div class={`${width} text-right px-2`}>
      <div class='text-[10px] font-medium text-base-content/35 uppercase tracking-wide'>
        {label}
      </div>
      <div class={`font-mono text-sm font-semibold tabular-nums ${valueClass}`}>
        {value}
        {unit && <span class={`text-[10px] ml-0.5 ${unitClass}`}>{unit}</span>}
      </div>
    </div>
  )
}

function MetricDetail() {
  const expanded = url.params.expanded
  const sorted = sortedMetrics.value
  const metric = expanded && sorted.find((metric) => metric.id === expanded)
  if (!metric) {
    expanded && navigate({ params: { expanded: null }, replace: true })
    return null
  }
  return (
    <div class='px-5 pb-5 pt-4 bg-base-200/20 border-t border-base-200 space-y-5'>
      <div>
        <div class='text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-2 flex items-center gap-1.5'>
          <Database class='w-3.5 h-3.5' /> Query
        </div>
        <pre class='font-mono text-[12px] text-base-content/80 bg-base-100 rounded-lg border border-base-200 p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed'>{metric.query}</pre>
      </div>
      <div class='grid grid-cols-1 lg:grid-cols-2 gap-5'>
        {metric.status && <StatusCounters status={metric.status} />}
        {metric.explain?.length > 0 && <QueryPlan explain={metric.explain} />}
      </div>
      <div class='flex justify-end'>
        <A
          class='btn btn-sm btn-primary gap-2'
          params={{ dialog: 'fix-with-ai' }}
        >
          <Sparkles class='w-4 h-4' />
          Fix with AI
        </A>
      </div>
    </div>
  )
}

function MetricRow({ metric }: MetricRowProps) {
  const isExpanded = url.params.expanded === metric.id
  const avg = formatDuration(metric.count && (metric.duration / metric.count))
  const maxFmt = metric.max != null ? formatDuration(metric.max) : null
  const totalFmt = formatDuration(metric.duration)
  const pct = (metric.duration / stats.value.totalDuration) * 100

  return (
    <div>
      <A
        class={`px-5 py-3 flex items-center gap-4 cursor-pointer hover:bg-base-200/40 transition-colors ${
          isExpanded ? 'bg-base-200/30' : ''
        }`}
        params={{ expanded: isExpanded ? null : metric.id }}
      >
        <div class='flex-1 min-w-0'>
          <div class='font-mono text-[13px] text-base-content/85 truncate'>
            {metric.query}
          </div>
          <div class='mt-1.5 h-1 bg-base-200 rounded-full overflow-hidden max-w-[200px]'>
            <div
              class={`h-full rounded-full ${
                pct > 66
                  ? 'bg-error/70'
                  : pct > 33
                  ? 'bg-warning/70'
                  : 'bg-success/70'
              }`}
              style={{ width: `${Math.max(2, pct)}%` }}
            />
          </div>
        </div>
        <div class='flex items-center shrink-0'>
          <StatCell label='Calls' value={metric.count} width='w-16' />
          <StatCell
            label='Avg'
            value={avg.value}
            unit={avg.unit}
            valueClass='text-secondary'
            unitClass='text-secondary/50'
          />
          <StatCell
            label='Max'
            value={maxFmt ? maxFmt.value : '—'}
            unit={maxFmt?.unit}
            valueClass='text-error/80'
            unitClass='text-error/40'
          />
          <StatCell
            label='Total'
            value={totalFmt.value}
            unit={totalFmt.unit}
            valueClass='text-base-content/60'
          />
          <div class='text-base-content/30 w-8 flex justify-center'>
            {isExpanded
              ? <ChevronDown class='w-4 h-4' />
              : <ChevronRight class='w-4 h-4' />}
          </div>
        </div>
      </A>
      {isExpanded && <MetricDetail />}
    </div>
  )
}

function MetricsSummaryBar() {
  const totalDuration = formatDuration(stats.value.totalDuration)
  return (
    <div class='flex items-center gap-6 px-5 py-3 border-b border-base-200 shrink-0 bg-base-100'>
      <div class='flex items-center gap-2 text-sm'>
        <Activity class='w-4 h-4 text-base-content/40' />
        <span class='font-semibold text-base-content'>
          {stats.value.totalCalls.toLocaleString()}
        </span>
        <span class='text-base-content/40'>total calls</span>
      </div>
      <div class='w-px h-4 bg-base-300' />
      <div class='flex items-center gap-2 text-sm'>
        <Timer class='w-4 h-4 text-base-content/40' />
        <span class='font-semibold text-base-content'>
          {totalDuration.value} {totalDuration.unit}
        </span>
        <span class='text-base-content/40'>total time</span>
      </div>
      <div class='w-px h-4 bg-base-300' />
      <div class='flex items-center gap-2 text-sm'>
        <BarChart2 class='w-4 h-4 text-base-content/40' />
        <span class='font-semibold text-base-content'>{stats.value.count}</span>
        <span class='text-base-content/40'>unique queries</span>
      </div>
    </div>
  )
}

function MetricsEmpty() {
  return (
    <div class='flex flex-col items-center justify-center py-20 gap-4 text-center'>
      <div class='h-16 w-16 rounded-full bg-base-200 flex items-center justify-center'>
        <BarChart class='w-8 h-8 text-base-content/20' />
      </div>
      <div>
        <h3 class='font-semibold text-base-content mb-1'>
          No metrics recorded
        </h3>
        <p class='text-sm text-base-content/50 max-w-xs mx-auto'>
          Execute database queries to see performance data here.
        </p>
      </div>
    </div>
  )
}

// ─── MetricsViewer ──────────────────────────────────────────────────────────

function MetricsViewer() {
  const isPending = metricsData.pending
  const sorted = sortedMetrics.value
  return (
    <div class='flex flex-col h-full min-h-0 relative bg-base-100'>
      {!!isPending && (
        <div class='absolute top-0 left-0 right-0 h-0.5 z-20 overflow-hidden bg-base-300'>
          <div class='h-full bg-primary animate-progress origin-left' />
        </div>
      )}
      <MetricsSummaryBar />
      <div class='flex-1 min-h-0 overflow-y-auto divide-y divide-base-200'>
        {sorted.map((metric) => <MetricRow key={metric.id} metric={metric} />)}
        {sorted.length === 0 && !isPending && <MetricsEmpty />}
      </div>
      <AiAnalysisDialog />
    </div>
  )
}

effect(() => {
  const rowId = url.params['row-id']
  const dep = url.params.dep

  if (dep && rowId) {
    const tableName = url.params.table || schema.data?.tables?.[0]?.table
    const tableDef = schema.data?.tables?.find((t) => t.table === tableName)
    const pk = tableDef?.columns?.[0]?.name

    if (tableName && pk) {
      rowDetailsData.fetch({
        deployment: dep,
        table: tableName,
        filter: [{
          key: pk,
          comparator: '=',
          value: rowId,
        }],
        sort: [],
        search: '',
        limit: 1,
        offset: 0,
      })
    }
  }
})

const RowDetails = () => {
  const row = rowDetailsData.data?.rows?.[0] as AnyRecord | undefined

  if (rowDetailsData.pending) {
    return (
      <div class='flex items-center justify-center p-8'>
        <span class='loading loading-spinner loading-md'></span>
      </div>
    )
  }

  if (rowDetailsData.error) {
    return (
      <div class='p-4 text-error'>
        Error loading row: {rowDetailsData.error.message}
      </div>
    )
  }

  if (!row) {
    return (
      <div class='p-4 text-base-content/60'>
        Row not found
      </div>
    )
  }

  const onUpdateRow = async (e: Event) => {
    e.preventDefault()
    const row = rowDetailsData.data?.rows?.[0] as AnyRecord | undefined
    if (!row) return
    const tableName = url.params.table || schema.data?.tables?.[0]?.table
    const tableDef = schema.data?.tables?.find((t) => t.table === tableName)
    const pk = tableDef?.columns?.[0]?.name
    if (!tableName || !pk) {
      toast('Could not identify table or primary key', 'error')
      return
    }

    const form = e.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    const data: Record<string, unknown> = {}

    for (const [key, val] of formData.entries()) {
      if (row[key] === val) continue
      const col = tableDef.columns.find((c) => c.name === key)
      if (!col) continue
      const type = col.type
      if (
        type.includes('Int') || type.includes('Float') ||
        type.includes('Decimal')
      ) {
        data[key] = Number(val)
      } else if (type.includes('Bool')) {
        data[key] = val === 'on'
      } else if (
        type.includes('JSON') || type.includes('Array') || type.includes('Map')
      ) {
        try {
          data[key] = JSON.parse(val as string)
        } catch {
          data[key] = val
        }
      } else {
        data[key] = val
      }
    }

    try {
      await api['POST/api/deployment/table/update'].fetch({
        deployment: url.params.dep!,
        table: tableName,
        pk: { key: pk, value: row[pk] as unknown as string },
        data,
      })
      toast('Row updated successfully')
      tableData.fetch()
      navigate({ params: { drawer: null, 'row-id': null } })
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  return (
    <div class='flex flex-col h-full bg-base-100'>
      <div class='p-4 border-b border-base-300 flex items-center justify-between sticky top-0 bg-base-100 z-10'>
        <h3 class='font-semibold text-lg'>Row Details</h3>
        <A
          params={{ drawer: null, 'row-id': null }}
          replace
          class='btn btn-ghost btn-sm btn-circle'
        >
          <XCircle class='h-5 w-5' />
        </A>
      </div>

      <form onSubmit={onUpdateRow} class='flex-1 flex flex-col min-h-0'>
        <div class='flex-1 overflow-y-auto p-4 space-y-4'>
          {Object.entries(row).map(([key, value]) => {
            const tableName = url.params.table ||
              schema.data?.tables?.[0]?.table
            const tableDef = schema.data?.tables?.find((t) =>
              t.table === tableName
            )
            const colDef = tableDef?.columns?.find((c) => c.name === key)
            const type = colDef?.type || 'String'

            const isObject = (type.includes('Map') || type.includes('Array') ||
              type.includes('Tuple') || type.includes('Nested') ||
              type.includes('JSON') || type.toLowerCase().includes('blob')) &&
              (typeof value === 'object' || typeof value === 'string')
            const isNumber = type.includes('Int') || type.includes('Float') ||
              type.includes('Decimal')
            const isBoolean = type.includes('Bool')
            const isDate = type.includes('Date') || type.includes('Time') ||
              (key.endsWith('At') &&
                (typeof value === 'number' || !isNaN(Number(value))))

            return (
              <div key={key} class='form-control'>
                <label class='label py-1'>
                  <span class='label-text text-xs font-semibold text-base-content/50 uppercase tracking-wider'>
                    {key}
                  </span>
                  <span class='label-text-alt text-[10px] opacity-50'>
                    {type}
                  </span>
                </label>

                {isObject
                  ? <ObjectInput name={key} defaultValue={value} />
                  : isBoolean
                  ? <BooleanInput name={key} defaultChecked={Boolean(value)} />
                  : isDate
                  ? (
                    <DateInput
                      name={key}
                      defaultValue={typeof value === 'number'
                        ? new Date(value < 10000000000 ? value * 1000 : value)
                          .toISOString()
                        : String(value)}
                    />
                  )
                  : isNumber
                  ? <NumberInput name={key} defaultValue={value as number} />
                  : <TextInput name={key} defaultValue={String(value ?? '')} />}
              </div>
            )
          })}
        </div>

        <div class='p-4 border-t border-base-300 sticky bottom-0 bg-base-100'>
          <button type='submit' class='btn btn-primary w-full'>
            <Save class='h-4 w-4' />
            Update Row
          </button>
        </div>
      </form>
    </div>
  )
}

// Input components for RowDetails
const ObjectInput = (
  { defaultValue, readOnly, name }: {
    defaultValue?: unknown
    readOnly?: boolean
    name?: string
  },
) => {
  const stringified = typeof defaultValue === 'string'
    ? defaultValue
    : JSON.stringify(defaultValue, null, 2)
  return (
    <textarea
      name={name}
      class={`textarea textarea-bordered font-mono text-sm min-h-32 resize-y ${
        readOnly ? 'bg-base-200/50' : ''
      }`}
      defaultValue={stringified}
      readOnly={readOnly}
    />
  )
}

const BooleanInput = (
  { defaultChecked, readOnly, name }: {
    defaultChecked?: boolean
    readOnly?: boolean
    name?: string
  },
) => (
  <div class='flex items-center gap-3 p-2'>
    <input
      type='checkbox'
      name={name}
      class='toggle toggle-primary'
      defaultChecked={defaultChecked}
      disabled={readOnly}
    />
    <span class='text-sm font-mono'>{String(defaultChecked)}</span>
  </div>
)

const NumberInput = (
  { defaultValue, readOnly, name }: {
    defaultValue?: number | string
    readOnly?: boolean
    name?: string
  },
) => (
  <input
    type='number'
    name={name}
    class={`input input-bordered font-mono text-sm ${
      readOnly ? 'bg-base-200/50' : ''
    }`}
    defaultValue={defaultValue}
    readOnly={readOnly}
  />
)

const DateInput = (
  { defaultValue, readOnly, name }: {
    defaultValue?: string
    readOnly?: boolean
    name?: string
  },
) => (
  <input
    type='datetime-local'
    name={name}
    class={`input input-bordered font-mono text-sm ${
      readOnly ? 'bg-base-200/50' : ''
    }`}
    defaultValue={String(defaultValue || '').slice(0, 16)}
    readOnly={readOnly}
  />
)

const TextInput = (
  { defaultValue, readOnly, name }: {
    defaultValue?: string
    readOnly?: boolean
    name?: string
  },
) => (
  <input
    type='text'
    name={name}
    class={`input input-bordered font-mono text-sm ${
      readOnly ? 'bg-base-200/50' : ''
    }`}
    defaultValue={defaultValue}
    readOnly={readOnly}
  />
)

// Effect to fetch log details when log-id changes
effect(() => {
  const { dep } = url.params
  const logId = url.params['log-id']
  if (dep && logId) {
    logDetailsData.fetch({
      deployment: dep,
      filter: [{
        key: 'id',
        comparator: '=',
        value: logId,
      }],
      sort: [],
      search: '',
      limit: 1,
      offset: 0,
    })
  }
})

const LogDetails = () => {
  const log = logDetailsData.data?.[0]

  if (logDetailsData.pending) {
    return (
      <div class='flex items-center justify-center p-8 h-full'>
        <span class='loading loading-spinner loading-md'></span>
      </div>
    )
  }

  if (logDetailsData.error) {
    return (
      <div class='p-4 text-error h-full flex items-center justify-center'>
        <div class='flex flex-col items-center gap-2'>
          <AlertTriangle class='h-6 w-6' />
          <span>Error loading log: {logDetailsData.error.message}</span>
        </div>
      </div>
    )
  }

  if (!log) {
    return (
      <div class='p-4 text-base-content/60 h-full flex items-center justify-center'>
        <div class='flex flex-col items-center gap-2'>
          <Search class='h-6 w-6 opacity-50' />
          <span>Log not found</span>
        </div>
      </div>
    )
  }

  return (
    <div class='flex flex-col h-full bg-base-100'>
      <div class='px-4 py-3 border-b border-base-300 flex items-center justify-between sticky top-0 bg-base-100/95 backdrop-blur z-20'>
        <div class='flex items-center gap-2'>
          <div
            class={`badge badge-sm ${
              severityConfig[
                getSeverityText(
                  log.severity_number,
                  log.severity_text,
                ) as keyof typeof severityConfig
              ]?.color || 'badge-ghost'
            }`}
          >
            {getSeverityText(log.severity_number, log.severity_text)}
          </div>
          <h3 class='font-bold text-base'>{log.event_name}</h3>
        </div>
        <A
          params={{ drawer: null, 'log-id': null }}
          replace
          class='btn btn-ghost btn-sm btn-circle'
        >
          <XCircle class='h-5 w-5' />
        </A>
      </div>

      <div class='flex-1 overflow-y-auto p-4 space-y-4'>
        <div class='grid grid-cols-2 gap-2'>
          <Hex128Block hex={log.trace_id} type='trace' />
          <Hex128Block hex={log.span_id} type='span' />
        </div>

        <InfoBlock label='Log ID' value={log.id} mono copy />

        <div class='grid grid-cols-2 gap-2'>
          <InfoBlock
            label='Timestamp'
            value={safeFormatTimestamp(new Date(log.timestamp))}
            mono
          />
          <InfoBlock
            label='Observed'
            value={safeFormatTimestamp(
              new Date(
                (log as AnyRecord).observed_timestamp as string ||
                  log.timestamp,
              ),
            )}
            mono
          />
        </div>

        <div class='grid grid-cols-3 gap-2'>
          <InfoBlock label='Service' value={log.service_name} />
          <InfoBlock label='Version' value={log.service_version} />
          <InfoBlock
            label='Instance'
            value={log.service_instance_id}
            mono
            copy
          />
        </div>

        <SeverityBlock
          severityNumber={log.severity_number}
          severityText={log.severity_text}
        />
        {log.body && <BodyBlock body={log.body} />}
        <AttributesBlock attributes={log.attributes} />
      </div>
    </div>
  )
}

const InsertRow = () => {
  const tableName = url.params.table || schema.data?.tables?.[0]?.table
  const tableDef = schema.data?.tables?.find((t) => t.table === tableName)

  if (!tableName || !tableDef) {
    return (
      <div class='p-4 text-base-content/60'>
        Select a table from the schema panel first.
      </div>
    )
  }

  const onInsert = async (e: Event) => {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    const data: Record<string, unknown> = {}

    for (const [key, val] of formData.entries()) {
      const col = tableDef.columns.find((c) => c.name === key)
      if (!col) continue
      const type = col.type
      if (
        type.includes('Int') || type.includes('Float') ||
        type.includes('Decimal')
      ) {
        data[key] = Number(val)
      } else if (type.includes('Bool')) {
        data[key] = val === 'on'
      } else if (
        type.includes('JSON') || type.includes('Array') || type.includes('Map')
      ) {
        try {
          data[key] = JSON.parse(val as string)
        } catch {
          data[key] = val
        }
      } else {
        data[key] = val
      }
    }

    try {
      await api['POST/api/deployment/table/insert'].fetch({
        deployment: url.params.dep!,
        table: tableName,
        data,
      })
      toast('Row inserted successfully')
      tableData.fetch()
      navigate({ params: { drawer: null } })
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  return (
    <div class='flex flex-col h-full bg-base-100'>
      <div class='p-4 border-b border-base-300 flex items-center justify-between sticky top-0 bg-base-100 z-10'>
        <h3 class='font-semibold text-lg'>Insert Row: {tableName}</h3>
        <A
          params={{ drawer: null }}
          replace
          class='btn btn-ghost btn-sm btn-circle'
        >
          <XCircle class='h-5 w-5' />
        </A>
      </div>
      <form onSubmit={onInsert} class='flex-1 flex flex-col min-h-0'>
        <div class='flex-1 overflow-y-auto p-4 space-y-4'>
          {tableDef.columns.map((col) => {
            const type = col.type
            const key = col.name
            const isObject = type.includes('Map') || type.includes('Array') ||
              type.includes('Tuple') || type.includes('Nested') ||
              type.includes('JSON') || type.toLowerCase().includes('blob')
            const isNumber = type.includes('Int') || type.includes('Float') ||
              type.includes('Decimal')
            const isBoolean = type.includes('Bool')
            const isDate = type.includes('Date') || type.includes('Time')

            return (
              <div key={key} class='form-control'>
                <label class='label py-1'>
                  <span class='label-text text-xs font-semibold text-base-content/50 uppercase tracking-wider'>
                    {key}
                  </span>
                  <span class='label-text-alt text-[10px] opacity-50'>
                    {type}
                  </span>
                </label>
                {isObject
                  ? <ObjectInput name={key} />
                  : isBoolean
                  ? <BooleanInput name={key} />
                  : isDate
                  ? <DateInput name={key} />
                  : isNumber
                  ? <NumberInput name={key} />
                  : <TextInput name={key} />}
              </div>
            )
          })}
        </div>
        <div class='p-4 border-t border-base-300 sticky bottom-0 bg-base-100'>
          <button type='submit' class='btn btn-primary w-full'>
            <Plus class='h-4 w-4' />
            Insert Row
          </button>
        </div>
      </form>
    </div>
  )
}

type DrawerTab = 'history' | 'insert' | 'view-row' | 'view-log'
const drawerViews: Record<DrawerTab, ComponentChildren> = {
  history: <QueryHistory />,
  insert: <InsertRow />,
  'view-row': <RowDetails />,
  'view-log': <LogDetails />,
} as const

const Drawer = ({ children }: { children: ComponentChildren }) => (
  <div class='drawer h-full relative' dir='rtl'>
    <input
      id='drawer-right'
      type='checkbox'
      class='drawer-toggle'
      checked={url.params.drawer !== null}
      onChange={(e) => {
        if (!e.currentTarget.checked) {
          navigate({
            params: { drawer: null, 'row-id': null, 'log-id': null },
            replace: true,
          })
        }
      }}
    />
    <div class='drawer-content flex flex-col h-full overflow-hidden' dir='ltr'>
      {children}
    </div>
    <div class='drawer-side z-50 absolute h-full w-full pointer-events-none'>
      <label
        for='drawer-right'
        aria-label='close sidebar'
        class='drawer-overlay absolute inset-0 pointer-events-auto'
        dir='ltr'
      >
      </label>
      <div
        class='bg-base-200 text-base-content h-full flex flex-col resize-x overflow-auto pointer-events-auto'
        style={{
          direction: 'rtl',
          width: url.params.drawer === 'view-log' ? '600px' : '400px',
          minWidth: '300px',
          maxWidth: '80vw',
        }}
      >
        <div
          class='flex-1 flex flex-col h-full overflow-hidden'
          style={{ direction: 'ltr' }}
        >
          <div class='flex-1 overflow-hidden'>
            <div class='drawer-view h-full' data-view='history'>
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
  </div>
)

export const DeploymentPage = () => {
  const tab = activeTab.value
  const params = new Map<string, string>()
  url.params.tab === tab || params.set('tab', tab)
  url.params.sbi || params.set('sbi', 'deployment')
  params.size && navigate({ params: Object.fromEntries(params), replace: true })
  return (
    <div class='h-screen flex flex-col'>
      <Header />
      <div class='flex flex-1 min-h-0 pb-15'>
        <main class='flex-1 flex flex-col h-full'>
          <TabNavigation />
          <section class='flex-1 h-full overflow-hidden'>
            <Drawer>
              <div class='h-full bg-base-100 border border-base-300 overflow-hidden flex flex-col lg:flex'>
                {TabViews[tab]}
              </div>
            </Drawer>
          </section>
        </main>
      </div>
      <Toast />
    </div>
  )
}
