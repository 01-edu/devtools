import { A, navigate, url } from '../lib/router.tsx'
import {
  ArrowUpDown,
  Download,
  FileText,
  Filter,
  Play,
  Plus,
  Save,
  Search,
  ChevronsDown,
} from 'lucide-preact'
import { deployments, sidebarItems } from './ProjectPage.tsx'

export function QueryEditor() {
  const query = url.params.q || ''

  return (
    <div className='flex flex-col flex-1'>
      <div class='relative h-97/100'>
        <div class='absolute z-1  inset-y-0 left-0 w-10 select-none bg-base-200/20 overflow-hidden'>
          <div class='m-0 p-2 text-xs font-mono text-base-content/50 leading-6 text-right'>
            {Array.from({
              length: Math.max(1, (query.match(/\n/g)?.length ?? 0) + 1),
            }).map((_, i) => <div key={i}>{i + 1}</div>)}
          </div>
        </div>
        <textarea
          value={query}
          onInput={(e) =>
            navigate({
              params: { q: (e.target as HTMLTextAreaElement).value },
            })}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
            }
          }}
          spellcheck={false}
          class='textarea w-full h-full font-mono text-sm leading-6 pl-12 pr-3 py-2 bg-base-100 border-base-300 focus:outline-none focus:ring-0 focus:shadow-none focus:border-base-300 resize-none'
          placeholder='-- Write SQL here. Press Ctrl+Enter to run'
          aria-label='SQL editor'
        />
      </div>
      {/* <DataTable /> */}
    </div>
  )
}

const logData = [
  {
    id: 1,
    service_name: 'default',
    service_version: '28e4e8060583...',
    service_instance_id: '1757583536.8...',
    timestamp: '1970-01-21 0...',
    observed_timestamp: '2025-09-11 0...',
    trace_id: '41da30a62c38...',
    span_id: '41da30a62c38...',
    severity_number: 9,
    severity_text: 'INFO',
    body: '',
    attributes: '{}',
    event_name: 'server-start',
  },
]

export function DataTable() {
  return (
    <div class='flex-1 flex flex-col max-h-92/100'>
      <div class='overflow-x-auto bg-base-100 border border-base-300 h-full'>
        <table class='table table-sm'>
          <thead class='bg-base-200'>
            <tr>
              <th>#</th>
              {Object.keys(logData[0]).map((key) => <th key={key}>{key}</th>)}
            </tr>
          </thead>
          <tbody>
            {logData.map((row, index) => (
              <tr key={row.id} class='hover'>
                <td>{index + 1}</td>
                {Object.entries(row).map(([key, value]) => (
                  <td key={key}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class='bg-base-100 border-t border-base-300 px-6 py-3'>
        <div class='flex items-center justify-between text-sm text-base-content/60'>
          <span>4 rows</span>
          <div class='flex items-center gap-2'>
            <span>of 1</span>
            <div class='join'>
              <button type='button' class='join-item btn btn-sm'>‹</button>
              <button type='button' class='join-item btn btn-sm'>›</button>
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

  return (
    <div class='navbar bg-base-100 border-b border-base-300'>
      <div class='flex-1'>
        <div class='flex items-center gap-10 justify-start'>
          <div class='flex items-center gap-3'>
            <item.icon class='h-6 w-6 text-orange-500' />
            <span class='text-lg font-semibold'>{item.label}</span>
          </div>
          <select class='select'>
            {deployments.data?.map((deployment) => (
              <option
                selected={dep === deployment.url}
                value={deployment.url}
                key={deployment.url}
              >
                {deployment.url}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div class='flex-none'>
        <button type='button' class='btn btn-outline btn-sm'>
          <FileText class='h-4 w-4 mr-2' />
          Queries
        </button>
      </div>
    </div>
  )
}

export function LeftPanel() {
  return (
    <div class='w-70 bg-base-100 border-r border-base-300 flex flex-col'>
      <div class='p-4  flex-1 overflow-y-auto space-y-1'>
        <div class='text-xs text-base-content/60 mb-2'>Tables (1)</div>
        <div class='flex items-center justify-between p-2 hover:bg-base-200 rounded-md cursor-pointer'>
          <span class='text-sm'>Users</span>
          <ChevronsDown class='h-4 w-4' />
        </div>
        <div class='flex items-center justify-between p-2 hover:bg-base-200 rounded-md cursor-pointer'>
          <span class='text-sm'>Entries</span>
          <ChevronsDown class='h-4 w-4' />
        </div>
      </div>
    </div>
  )
}

export function TabNavigation({
  activeTab = 'tables',
}: { activeTab?: 'tables' | 'queries' | 'logs' }) {
  const tabClass = (t: 'tables' | 'queries' | 'logs') =>
    `tab ${activeTab === t ? 'tab-active' : ''}`

  return (
    <div class='bg-base-100 border-b border-base-300'>
      <div class='tabs tabs-bordered px-6 h-full flex items-center'>
        <div role='tablist' class='tabs tabs-border'>
          <A params={{ tab: 'tables' }} role='tab' class={tabClass('tables')}>
            Tables
          </A>
          <A params={{ tab: 'queries' }} role='tab' class={tabClass('queries')}>
            Queries
          </A>
          <A params={{ tab: 'logs' }} role='tab' class={tabClass('logs')}>
            Logs
          </A>
        </div>

        <div class='ml-auto flex items-center gap-2 p-2'>
          {activeTab === 'tables' || activeTab === 'logs'
            ? (
              <label class='input  input-sm '>
                <Search class=' opacity-50' />
                <input type='search' class='grow' placeholder='Search' />
              </label>
            )
            : null}
          {activeTab !== 'logs' && (
            <label for='my-drawer-4' class='btn btn-primary btn-sm'>
              {activeTab === 'queries'
                ? <Play class='h-4 w-4' />
                : <Plus class='h-4 w-4' />}
              {activeTab === 'queries' ? 'Run query' : 'Insert row'}
            </label>
          )}
        </div>

        <div class='ml-2 flex items-center gap-2 p-2'>
          <button type='button' class='btn btn-outline btn-sm'>
            {activeTab !== 'queries'
              ? <Filter class='h-4 w-4' />
              : <Save class='h-4 w-4' />}
            <span>{activeTab !== 'queries' ? 'Filter' : 'Save'}</span>
          </button>
          <button type='button' class='btn btn-outline btn-sm'>
            {activeTab !== 'queries'
              ? <ArrowUpDown class='h-4 w-4' />
              : <Download class='h-4 w-4' />}
            <span>{activeTab !== 'queries' ? 'Sort' : 'Export'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const TabViews = {
  'tables': <DataTable />,
  'queries': <QueryEditor />,
  'logs': <DataTable />,
}

const Drawer = () => (
  <div class="drawer drawer-end">
  <input id="my-drawer-4" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content">
    <label for="my-drawer-4" class="drawer-button btn btn-primary">Open drawer</label>
  </div>
  <div class="drawer-side">
    <label for="my-drawer-4" aria-label="close sidebar" class="drawer-overlay"></label>
    <ul class="menu bg-base-200 text-base-content min-h-full w-80 p-4">
      <li><a>Sidebar Item 1</a></li>
      <li><a>Sidebar Item 2</a></li>
    </ul>
  </div>
</div>
)

export const DeploymentPage = () => {
  const tab = url.params.tab || 'tables'
  if (!['tables', 'queries', 'logs'].includes(tab)) {
    navigate({ params: { tab: 'tables' } })
  }

  const view = TabViews[tab as keyof typeof TabViews]
  return (
    <>
      <Header />
      <div class='flex flex-1'>
        <LeftPanel />
        <div class='flex-1 flex flex-col'>
          <TabNavigation activeTab={tab as 'tables' | 'queries' | 'logs'} />
          {view}
        </div>
      </div>
      <Drawer />
    </>
  )
}