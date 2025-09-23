import { A, navigate, url } from '../lib/router.tsx'
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  ChevronsDown,
  Clock,
  Download,
  Eye,
  FileText,
  Info,
  MoreHorizontal,
  Play,
  Plus,
  Save,
  Search,
  XCircle,
} from 'lucide-preact'
import { deployments, sidebarItems } from './ProjectPage.tsx'
import { FilterMenu, SortMenu } from '../components/Filtre.tsx'

type AnyRecord = Record<string, unknown>

export function QueryEditor() {
  const query = url.params.q || ''
  const results = [] as AnyRecord[]
  const running = false

  const onRun = async () => {
    // TODO: call backend here
  }

  return (
    <div class='flex flex-col flex-1 min-h-0 min-w-0'>
      <div class='relative flex-1 min-h-[12rem]'>
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
          class='textarea w-full h-full font-mono text-sm leading-6 pl-12 pr-3 py-3 bg-base-100 border-base-300 focus:outline-none focus:ring-0 focus:shadow-none focus:border-base-300 resize-y'
          placeholder='-- Write SQL here. Press Ctrl+Enter to run'
          aria-label='SQL editor'
        />
      </div>

      <div class='flex items-center justify-between px-4 sm:px-6 py-3 border-t border-base-300'>
        <div class='flex items-center gap-3'>
          <h2 class='text-sm sm:text-base font-medium'>Results</h2>
          <span class='text-xs text-base-content/60'>
            {running ? 'Running…' : `${results.length} rows`}
          </span>
        </div>
        <div class='text-xs text-base-content/60'>Query took 0.00 seconds.</div>
      </div>

      <div class='flex-1 min-h-0 overflow-auto'>
        <DataTable data={results} />
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
    attributes: {},
    event_name: 'server-start',
  },
  {
    id: 3,
    timestamp: '2024-01-15T10:30:45.123Z',
    observed_timestamp: '2024-01-15T10:30:45.125Z',
    service_name: 'api-gateway',
    service_version: '1.2.3',
    service_instance_id: 'api-gw-001',
    trace_id: 'a1b2c3d4e5f6g7h8',
    span_id: 'x1y2z3w4',
    severity_number: 17,
    severity_text: 'ERROR',
    body: 'Database connection timeout after 30s',
    event_name: 'db_connection_error',
    attributes: {
      'db.name': 'users_db',
      'db.operation': 'SELECT',
      'error.type': 'TimeoutError',
    },
  },
  {
    id: 2,
    timestamp: '2024-01-15T10:30:42.456Z',
    observed_timestamp: '2024-01-15T10:30:42.458Z',
    service_name: 'user-service',
    service_version: '2.1.0',
    service_instance_id: 'user-svc-003',
    trace_id: 'b2c3d4e5f6g7h8i9',
    span_id: 'y2z3w4v5',
    severity_number: 9,
    severity_text: 'INFO',
    body: 'User authentication successful',
    event_name: 'auth_success',
    attributes: {
      'user.id': '12345',
      'auth.method': 'jwt',
      'request.duration_ms': 45,
    },
  },
]

export function DataTable({
  data = logData as AnyRecord[],
  page = 1,
  pageSize = 50,
  totalRows,
}: {
  data?: AnyRecord[]
  page?: number
  pageSize?: number
  totalRows?: number
}) {
  const columns = Object.keys(data[0] || {})

  const rows = data ?? []
  const count = totalRows ?? rows.length
  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  return (
    <div class='flex-1 flex flex-col min-h-0'>
      <div class='flex-1 min-h-0 overflow-x-auto overflow-y-auto'>
        <table class='table table-sm table-zebra table-fixed w-full'>
          <thead class='bg-base-200 sticky top-0 z-10'>
            <tr>
              <th class='w-10 sticky left-0 bg-base-200 z-10'>#</th>
              {columns.length > 0
                ? columns.map((key) => (
                  <th key={key} class='whitespace-nowrap'>{key}</th>
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
                <td class='sticky left-0 bg-base-100 z-10'>
                  {(page - 1) * pageSize + index + 1}
                </td>
                {columns.map((key, i) => {
                  const value = (row as AnyRecord)[key]
                  const isObj = typeof value === 'object' && value !== null
                  return (
                    <td
                      key={i}
                      class='max-w-xs truncate whitespace-nowrap align-top'
                    >
                      {isObj
                        ? (
                          <code class='font-mono text-xs text-base-content/70'>
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

export function LeftPanel() {
  return (
    <aside class='hidden lg:flex w-72 bg-base-100 border-r border-base-300 flex-col shrink-0'>
      <div class='p-4 flex-1 overflow-y-auto space-y-1'>
        <div class='text-xs text-base-content/60 mb-2'>Tables (2)</div>
        <button
          type='button'
          class='flex items-center justify-between p-2 hover:bg-base-200 rounded-md cursor-pointer w-full text-left'
        >
          <span class='text-sm'>Users</span>
          <ChevronsDown class='h-4 w-4' />
        </button>
        <button
          type='button'
          class='flex items-center justify-between p-2 hover:bg-base-200 rounded-md cursor-pointer w-full text-left'
        >
          <span class='text-sm'>Entries</span>
          <ChevronsDown class='h-4 w-4' />
        </button>
      </div>
    </aside>
  )
}

export function TabNavigation({
  activeTab = 'tables',
}: { activeTab?: 'tables' | 'queries' | 'logs' }) {
  const tab = (t: 'tables' | 'queries' | 'logs') => (
    <A
      params={{ tab: t }}
      role='tab'
      class={`tab ${activeTab === t ? 'tab-active' : ''}`}
    >
      {t.charAt(0).toUpperCase() + t.slice(1)}
    </A>
  )

  const filterKeyOptions = [
    'service_name',
    'service_version',
    'service_instance_id',
    'severity_text',
    'event_name',
  ] as const

  return (
    <div class='bg-base-100 border-b border-base-300 relative z-30'>
      <div class='tabs tabs-bordered px-2 sm:px-4 md:px-6 h-full flex items-center gap-2 overflow-x-auto'>
        <div
          role='tablist'
          class='tabs tabs-border overflow-x-auto whitespace-nowrap'
        >
          {tab('tables')}
          {tab('queries')}
          {tab('logs')}
        </div>

        <div class='ml-auto flex items-center gap-2 p-2'>
          {(activeTab === 'tables' || activeTab === 'logs') && (
            <label class='input input-sm w-[42vw] sm:w-64 md:w-72 lg:w-80'>
              <Search class='opacity-50' />
              <input type='search' class='grow' placeholder='Search' />
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
        </div>

        <div class='ml-1 sm:ml-2 flex items-center gap-2 p-2'>
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
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return timestamp
  try {
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  } catch {
    return d.toISOString()
  }
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
    <div class='flex-1 min-h-0 flex flex-col'>
      <div class='flex-1 min-h-0 overflow-x-auto overflow-y-auto'>
        <table class='table table-zebra table-fixed w-full'>
          <thead class='sticky top-0 z-10 bg-base-100'>
            <tr class='border-b border-base-300'>
              {logThreads.map((header) => (
                <th
                  key={header}
                  class='text-left font-medium text-base-content/70 whitespace-nowrap'
                >
                  {header}
                </th>
              ))}
              <th class='text-left font-medium text-base-content/70 w-16'></th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => {
              const conf =
                severityConfig[log.severity_text as keyof typeof severityConfig]
              const SeverityIcon = conf?.icon || Info
              const severityColor = conf?.color || 'text-base-content'
              const severityBg = conf?.bg || 'bg-base-300/10'

              return (
                <tr
                  key={log.id}
                  class='hover:bg-base-200/50 border-b border-base-300/50'
                >
                  <td class='font-mono text-xs sm:text-sm text-base-content/70 whitespace-nowrap'>
                    <div class='flex items-center gap-2 truncate'>
                      <Clock class='w-3 h-3 shrink-0' />
                      {safeFormatTimestamp(log.timestamp)}
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
                  <td class='max-w-md'>
                    <div class='flex flex-col'>
                      <span class='text-sm text-base-content'>
                        {log.event_name}
                      </span>
                      <span class='text-xs text-base-content/50 truncate inline-block max-w-[25ch]'>
                        {log.body}
                      </span>
                    </div>
                  </td>
                  <td class='font-mono text-[10px] sm:text-xs text-base-content/50 truncate whitespace-nowrap hidden md:table-cell'>
                    {log.trace_id}
                  </td>
                  <td class='font-mono text-[10px] sm:text-xs text-base-content/50 truncate whitespace-nowrap hidden md:table-cell'>
                    {log.span_id}
                  </td>
                  <td class='text-[10px] sm:text-xs text-base-content/60 hidden lg:table-cell'>
                    <code class='font-mono truncate inline-block max-w-[50ch] whitespace-nowrap'>
                      {JSON.stringify(log.attributes ?? {}, null, 2)}
                    </code>
                  </td>
                  <td class='align-middle'>
                    <div class='flex items-center gap-1 sm:gap-2'>
                      <button
                        type='button'
                        class='btn btn-ghost btn-xs sm:btn-sm'
                        aria-label='Toggle details'
                      >
                        <Eye class='w-4 h-4' />
                      </button>
                      <button
                        type='button'
                        class='btn btn-ghost btn-xs sm:btn-sm'
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
  <div class='drawer drawer-end'>
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
