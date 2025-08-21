import { PageContent, PageHeader } from '../../components/Layout.tsx'
import { url } from '../../lib/router.tsx'

import { A, navigate } from '../../lib/router.tsx'
import { Database, Logs, Search } from 'lucide-preact'
import { Project } from '../../../api/schema.ts'

// Mock data for deployments
const deployments: Deployment[] = [
  {
    url: 'beta.example.com',
    status: 'success',
    createdAt: '2024-08-18T10:00:00Z',
  },
  {
    url: 'staging.example.com',
    status: 'failed',
    createdAt: '2024-08-18T11:30:00Z',
  },
]

type Deployment = {
  url: string
  status: 'success' | 'failed' | 'running'
  createdAt: string
}

const badgeColors: Record<string, string> = {
  success: 'badge-success',
  failed: 'badge-error',
  running: 'badge-info',
  unknown: 'badge-ghost',
}

const DeploymentCard = ({ dep }: { dep: Deployment }) => {
  const badgeColor = badgeColors[dep.status] || badgeColors.unknown
  return (
    <div
      key={dep.url}
      class='card bg-base-200 shadow-md hover:shadow-lg transition-shadow duration-300'
    >
      <div class='card-body'>
        <div class='flex justify-between items-start'>
          <h2 class='card-title text-lg font-mono'>{dep.url}</h2>
          <span class={`badge ${badgeColor}`}>
            {dep.status}
          </span>
        </div>
        <div class='mt-2 space-y-1 text-sm'>
          <p>
            Some metadata about the deployment can go here
          </p>
        </div>
        <div class='card-actions justify-end mt-4'>
          <A
            params={{ deployment: dep.url }}
            class='btn btn-primary btn-sm'
          >
            View Details
          </A>
        </div>
      </div>
    </div>
  )
}

const LogsSection = () => {
  return (
    <div>
      <h2 class='text-lg font-semibold'>Logs</h2>
      <p>Log details for the selected deployment will go here.</p>
    </div>
  )
}

const DatabaseSection = () => {
  return (
    <div>
      <h2 class='text-lg font-semibold'>Database</h2>
      <p>Database details for the selected deployment will go here.</p>
    </div>
  )
}

export const DeploymentPage = ({}: { project: Project }) => {
  const { deployment, deptab } = url.params

  const selectedDeployment = deployment
    ? deployments.find((d) => d.url === deployment)
    : null

  const tab = deptab === 'logs' ? <LogsSection /> : <DatabaseSection />
  return (
    <>
      <PageHeader className='gap-4 bg-base-200'>
        <div class='flex items-center'>
          <A
            params={{ deployment: null }}
            class='text-xl sm:text-2xl font-semibold text-text'
          >
            Deployments
          </A>
        </div>
        <div class='flex items-center gap-2'>
          <div class='relative'>
            <select
              onChange={(e) =>
                e.target &&
                navigate({
                  params: { deployment: (e.target as HTMLSelectElement).value },
                })}
              value={deployment ?? undefined}
              class='select select-'
            >
              <option disabled selected>Select Deployment</option>
              {deployments.map((dep) => (
                <option key={dep.url} value={dep.url}>
                  {dep.url}
                </option>
              ))}
            </select>
          </div>
          <div class='tabs tabs-boxed'>
            <A
              params={{ deptab: 'logs' }}
              class={`tab ${deptab === 'logs' ? 'tab-active' : ''} gap-2`}
            >
              <Logs class='w-4 h-4' /> Logs
            </A>
            <A
              params={{ deptab: 'database' }}
              class={`tab ${deptab === 'database' ? 'tab-active' : ''} gap-2`}
            >
              <Database class='w-4 h-4' /> Database
            </A>
          </div>
          <div class='relative w-full sm:w-auto sm:max-w-sm'>
            <Search class='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text2 pointer-events-none' />
            <input
              type='text'
              placeholder='Search...'
              class='w-full bg-surface2 border border-divider rounded-lg py-2 pl-10 pr-4 text-sm placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all'
            />
          </div>
        </div>
      </PageHeader>
      <PageContent>
        {selectedDeployment
          ? tab
          : (
            <div class='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
              {deployments.map((dep) => (
                <DeploymentCard key={dep.url} dep={dep} />
              ))}
            </div>
          )}
      </PageContent>
    </>
  )
}
