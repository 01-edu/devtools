import { A, navigate, url } from '../lib/router.tsx'
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Clock,
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
import { api } from '../lib/api.ts'
import { effect } from '@preact/signals'

type AnyRecord = Record<string, unknown>

const onRun = async () => {
  // TODO: call backend here
}

const schema = api['GET/api/deployment/schema'].signal()

effect(() => {
  const dep = url.params.dep
  if (dep) {
    schema.fetch({ url: dep })
  }
})

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
type Order = 'ASC' | 'DESC'

effect(() => {
  const { dep, tab, table, tq } = url.params
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
        search: tq || '',
        limit: '50',
        offset: '0',
      })
    }
  }
})

export function QueryEditor() {
  const query = url.params.q || ''
  const results: AnyRecord[] = []
  const running = false

  return (
    <div class='flex flex-col h-full min-h-0 gap-4'>
      <div class='flex-1 min-h-0 overflow-hidden'>
        <div class='relative h-full'>
          <div class='absolute inset-y-0 left-0 w-10 select-none bg-base-200/40 overflow-hidden border-r border-base-300 z-10'>
            <div class='m-0 px-2 py-2 text-xs font-mono text-base-content/50 leading-6 text-right'>
              {Array(Math.max(1, (query.match(/\n/g)?.length ?? 0) + 1))
                .keys().map((i) => <div key={i}>{i + 1}</div>).toArray()}
            </div>
          </div>

          <textarea
            value={query}
            onInput={(e) => {
              const v = (e.target as HTMLTextAreaElement).value
              navigate({ params: { q: v } })
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                onRun()
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
              {running ? 'Running…' : `${results.length} rows`}
            </span>
          </div>
          <div class='text-xs text-base-content/60 tabular-nums'>
            Query took 0.00 seconds.
          </div>
        </div>
      </div>

      <div class='flex-1 min-h-0 overflow-hidden'>
        <DataTable />
      </div>
    </div>
  )
}

const logData = [
  {
    id: 1,
    service_name: 'default',
    service_version: '28e4e8060583...',
    service_instance_id: '1757583536.8...',
    timestamp: '1970-01-21T00:00:00.000Z',
    observed_timestamp: '2025-09-11T00:00:00.000Z',
    trace_id: '41da30a62c38...',
    span_id: '41da30a62c38...',
    severity_number: 9,
    severity_text: 'INFO',
    body: '',
    attributes: {
      http_method: 'GET',
      http_url: '/home',
      http_status_code: 200,
      http_user_agent: 'Mozilla/5.0...',
      net_peer_ip: '192.168.1.1',
    },
    event_name: 'server-start',
  },
]

export function DataTable({
  page = 1,
  pageSize = 50,
  totalRows,
}: {
  page?: number
  pageSize?: number
  totalRows?: number
}) {
  const { tab } = url.params
  const data = tab === 'tables' ? tableData.data || [] : []
  const columns = Object.keys(data[0] || {})
  const rows = data || []
  const count = totalRows ?? rows.length
  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  return (
    <div class='flex flex-col h-full min-h-0 pb-15'>
      <div class='flex-1 min-h-0 overflow-hidden'>
        <div class='w-full overflow-x-auto overflow-y-auto h-full'>
          <table class='table table-zebra w-full'>
            <thead class='sticky top-0 z-20 bg-base-100'>
              <tr>
                <th class='sticky left-0 bg-base-100 z-30 min-w-[3rem]'>#</th>
                {columns.length > 0
                  ? columns.map((key) => (
                    <th key={key} class='whitespace-nowrap '>
                      {key}
                    </th>
                  ))
                  : <th class='text-left'>No columns</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    class='p-6 text-base-content/60'
                    colSpan={Math.max(2, columns.length + 1)}
                  >
                    No results to display
                  </td>
                </tr>
              )}
              {rows.map((row, index) => (
                <tr key={(row.id as number) ?? `${index}`} class='hover'>
                  <td class='sticky left-0 bg-base-100 z-20 tabular-nums'>
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  {columns.map((key, i) => {
                    const value = (row as AnyRecord)[key]
                    const isObj = typeof value === 'object' && value !== null
                    return (
                      <td
                        key={i}
                        class='whitespace-normal break-words md:whitespace-nowrap md:overflow-hidden md:text-ellipsis align-top'
                      >
                        {isObj
                          ? (
                            <code class='font-mono text-xs text-base-content/70 truncate inline-block max-w-[12rem]'>
                              {JSON.stringify(value)}
                            </code>
                          )
                          : (
                            String(value ?? '')
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

      <div class='bg-base-100 border-t border-base-300 px-4 sm:px-6 py-3 shrink-0'>
        <div class='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-base-content/60'>
          <span>{count} rows</span>
          <div class='flex items-center gap-2'>
            <span>Page {page} of {totalPages}</span>
            <div class='join'>
              <button type='button' class='join-item btn btn-sm' disabled>
                ‹
              </button>
              <button type='button' class='join-item btn btn-sm' disabled>
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Header() {
  const item = sidebarItems[url.params.sbi || Object.keys(sidebarItems)[0]]
  const dep = url.params.dep || deployments.data?.[0]?.url

  const onChangeDeployment = (e: Event) => {
    const v = (e.target as HTMLSelectElement).value
    navigate({ params: { dep: v } })
  }

  return (
    <div class='navbar bg-base-100 border-b border-base-300 sticky top-0 z-20'>
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
              value={dep}
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
        <button type='button' class='btn btn-outline btn-xs md:btn-sm'>
          <FileText class='h-4 w-4 mr-2' />
          <span class='hidden sm:inline'>Queries</span>
        </button>
      </div>
    </div>
  )
}

type Schema = {
  dialect: string
  tables: {
    schema?: string
    table: string
    columns: { name: string; type: string; ordinal: number }[]
  }[]
}

const groupeTables = (schema?: Schema) => {
  if (!schema?.tables?.length) return {}

  const groups: Record<string, Array<typeof schema.tables[0]>> = {}

  for (const table of schema.tables) {
    if (!table.table || !Array.isArray(table.columns)) continue

    const schemaName = table.schema || 'default'
    if (!groups[schemaName]) {
      groups[schemaName] = []
    }
    groups[schemaName].push(table)
  }

  for (const schemaName in groups) {
    groups[schemaName].sort((a, b) => a.table.localeCompare(b.table))
  }

  return groups
}

export function LeftPanel() {
  const dep = url.params.dep || deployments.data?.[0]?.url

  const grouped = groupeTables(schema.data)
  return (
    <aside class='hidden lg:flex w-72 bg-base-100 border-r border-base-300 flex-col shrink-0'>
      <div class='p-4 flex-1 overflow-y-auto space-y-1'>
        <div class='flex items-center justify-between mb-3'>
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

        {!schema.pending && !schema.error && schema && (
          <div class='space-y-2'>
            {Object.entries(grouped).map(([schemaName, tables]) => (
              <div key={schemaName} class='space-y-1'>
                {schemaName !== 'default' && (
                  <div class='text-xs font-medium text-base-content px-2 py-1 bg-base-200/50 rounded'>
                    {schemaName}
                  </div>
                )}

                <div class='space-y-1'>
                  {tables.map((table, index) => {
                    return (
                      <div
                        tabindex={index}
                        class='collapse collapse-arrow bg-base-200/50 rounded-sm items-center'
                      >
                        <A
                          params={{ tab: 'tables', table: table.table }}
                          class='collapse-title font-semibold flex items-end justify-between gap-2 flex-1 min-w-0 py-2'
                        >
                          <div class='flex items-center gap-2'>
                            <Table class='h-4 w-4 text-base-content/60 shrink-0' />
                            <span class='text-sm truncate'>{table.table}</span>
                          </div>
                          <span class='badge badge-outline badge-xs'>
                            {table.columns.length}
                          </span>
                        </A>
                        <div class='collapse-content text-sm'>
                          {table.columns
                            .sort((a, b) => a.ordinal - b.ordinal)
                            .map((column) => {
                              return (
                                <div class='flex items-center gap-2 p-1.5 rounded text-sm w-full text-left hover:bg-base-200/50'>
                                  <span class='w-1 h-1 bg-base-content/40 rounded-full shrink-0' />
                                  <span class='font-mono text-xs flex-1 truncate'>
                                    {column.name}
                                  </span>
                                  <span class='badge badge-ghost badge-xs text-xs'>
                                    {column.type}
                                  </span>
                                  <span class='text-xs text-base-content/40 tabular-nums hidden sm:block'>
                                    {column.ordinal}
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {(!schema.data?.tables || schema.data.tables.length === 0) && (
              <div class='text-center py-8 text-base-content/50'>
                <Table class='h-8 w-8 mx-auto mb-2 opacity-50' />
                <p class='text-sm'>No tables found</p>
              </div>
            )}
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
  activeTab,
}: { activeTab: 'tables' | 'queries' | 'logs' }) {
  const filterKeyOptions =
    schema.data?.tables.find((t) => t.table === url.params.table)?.columns.map((
      c,
    ) => c.name) || []

  return (
    <div class='bg-base-100 border-b border-base-300 relative z-30'>
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
                onInput={(e) => {
                  navigate({
                    params: { tq: (e.target as HTMLInputElement).value },
                  })
                }}
              />
            </label>
          )}
          {activeTab !== 'logs' && (
            <label htmlFor='my-drawer-4' class='btn btn-primary btn-sm'>
              {activeTab === 'queries'
                ? <Play class='h-4 w-4' />
                : <Plus class='h-4 w-4' />}
              <span class='hidden sm:inline'>
                {activeTab === 'queries' ? 'Run query' : 'Insert row'}
              </span>
            </label>
          )}
          {activeTab !== 'queries' && (
            <>
              <FilterMenu filterKeyOptions={filterKeyOptions} tag={activeTab} />
              <SortMenu sortKeyOptions={filterKeyOptions} tag={activeTab} />
            </>
          )}
          {activeTab === 'queries' && (
            <>
              <button type='button' class='btn btn-outline btn-sm'>
                <Save class='h-4 w-4' />
                <span class='hidden sm:inline'>Save</span>
              </button>
              <button type='button' class='btn btn-outline btn-sm'>
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

const severityConfig = {
  DEBUG: { icon: Bug, color: 'text-info', bg: 'bg-info/10' },
  INFO: { icon: Info, color: 'text-info', bg: 'bg-info/10' },
  WARN: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  ERROR: { icon: XCircle, color: 'text-error', bg: 'bg-error/10' },
  FATAL: { icon: AlertCircle, color: 'text-error', bg: 'bg-error/10' },
} as const

const safeFormatTimestamp = (timestamp: string) => {
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
  const filteredLogs = logData

  return (
    <div class='flex flex-col h-full min-h-0'>
      <div class='flex-1 min-h-0 overflow-hidden'>
        <div class='w-full overflow-x-auto overflow-y-auto h-full'>
          <table class='table table-zebra w-full'>
            <thead class='sticky top-0 z-20 bg-base-100'>
              <tr class='border-b border-base-300'>
                {logThreads.map((header) => (
                  <th
                    key={header}
                    class='text-left font-medium text-base-content/70 whitespace-nowrap'
                  >
                    {header}
                  </th>
                ))}
                <th class='text-left font-medium text-base-content/70 w-16'>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const conf = severityConfig[
                  log.severity_text as keyof typeof severityConfig
                ]
                const SeverityIcon = conf?.icon || Info
                const severityColor = conf?.color || 'text-base-content'
                const severityBg = conf?.bg || 'bg-base-300/10'

                return (
                  <tr
                    key={log.id}
                    class='hover:bg-base-200/50 border-b border-base-300/50'
                  >
                    <td class='font-mono text-xs text-base-content/70 tabular-nums'>
                      <div class='flex items-center gap-2 whitespace-normal break-words md:whitespace-nowrap'>
                        <Clock class='w-3 h-3 shrink-0' />
                        <span class='break-all md:break-normal'>
                          {safeFormatTimestamp(log.timestamp)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div
                        class={`badge badge-outline ${severityColor} ${severityBg} border-current/20`}
                      >
                        <SeverityIcon class='w-3 h-3 mr-1' />
                        {log.severity_text}
                      </div>
                    </td>
                    <td class='min-w-[12rem]'>
                      <div class='flex flex-col'>
                        <span class='text-sm text-base-content font-medium'>
                          {log.event_name}
                        </span>
                        {log.body && (
                          <span class='text-xs text-base-content/50 whitespace-normal break-words mt-1'>
                            {log.body}
                          </span>
                        )}
                      </div>
                    </td>
                    <td class='font-mono text-xs text-base-content/50 whitespace-normal break-all md:whitespace-nowrap hidden md:table-cell'>
                      {log.trace_id}
                    </td>
                    <td class='font-mono text-xs text-base-content/50 whitespace-normal break-all md:whitespace-nowrap hidden md:table-cell'>
                      {log.span_id}
                    </td>
                    <td class='text-xs text-base-content/60 hidden lg:table-cell'>
                      <code class='font-mono truncate inline-block max-w-[12rem]'>
                        {JSON.stringify(log.attributes ?? {}, null, 2)}
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

const TabViews = {
  tables: <DataTable />,
  queries: <QueryEditor />,
  logs: <LogsViewer />,
}

const Drawer = () => (
  <div class='drawer drawer-end z-40'>
    <input id='my-drawer-4' type='checkbox' class='drawer-toggle' />
    <div class='drawer-side'>
      <label
        htmlFor='my-drawer-4'
        aria-label='close sidebar'
        class='drawer-overlay'
      >
      </label>
      <ul class='menu bg-base-200 text-base-content min-h-full w-80 p-4'>
        <li>
          <a>Sidebar Item 1</a>
        </li>
        <li>
          <a>Sidebar Item 2</a>
        </li>
      </ul>
    </div>
  </div>
)

export const DeploymentPage = () => {
  const tab = (url.params.tab as 'tables' | 'queries' | 'logs') || 'tables'
  if (!['tables', 'queries', 'logs'].includes(tab)) {
    navigate({ params: { tab: 'tables' }, replace: true })
  }

  const view = TabViews[tab]
  return (
    <div class='flex flex-col h-full min-h-0'>
      <Header />
      <div class='flex flex-1 min-h-0'>
        <LeftPanel />
        <main class='flex-1 flex flex-col min-h-0 min-w-0'>
          <TabNavigation activeTab={tab} />
          <section class='flex-1 min-h-0 overflow-hidden'>
            <div class='h-full bg-base-100 border border-base-300 overflow-hidden flex flex-col'>
              {view}
            </div>
          </section>
        </main>
      </div>
      <Drawer />
    </div>
  )
}
