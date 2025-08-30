import { PageContent, PageHeader } from '../../components/Layout.tsx'
import { url } from '../../lib/router.tsx'

import { A, navigate } from '../../lib/router.tsx'
import { Calendar, Database, Logs, Search } from 'lucide-preact'
import { Deployment, Project } from '../../../api/schema.ts'
import { deployments } from '../ProjectPage.tsx'

const DeploymentCard = ({ dep }: { dep: Deployment }) => {
  const created = dep.createdAt ? new Date(dep.createdAt) : null
  const formattedDate = created ? created.toLocaleString() : 'Unknown'

  return (
    <div class='card bg-base-200 p-5 flex flex-col gap-3 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 border border-primary/20'>
      <span class='font-mono text-lg font-semibold text-primary break-all'>
        {dep.url}
      </span>
      <div class='flex gap-4 text-xs mt-1'>
        <span
          class={`flex items-center gap-1 px-2 py-1 rounded ${
            dep.logsEnabled
              ? 'bg-success/10 text-success'
              : 'bg-error/10 text-error'
          }`}
        >
          <Logs class='w-4 h-4' />
          Logs: {dep.logsEnabled ? 'Enabled' : 'Disabled'}
        </span>
        <span
          class={`flex items-center gap-1 px-2 py-1 rounded ${
            dep.databaseEnabled
              ? 'bg-success/10 text-success'
              : 'bg-error/10 text-error'
          }`}
        >
          <Database class='w-4 h-4' />
          Database: {dep.databaseEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <span class='text-xs text-text2 mt-2'>
        <Calendar class='w-4 h-4' />
        Created At : <span class='font-semibold'>{formattedDate}</span>
      </span>
      <A
        {...(dep.logsEnabled || dep.databaseEnabled)
          ? { params: { deployment: dep.url } }
          : {}}
        class='btn btn-primary btn-xs self-end mt-2'
      >
        View Details
      </A>
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

  if (
    selectedDeployment && deptab === 'logs' && !selectedDeployment.logsEnabled
  ) {
    navigate({
      params: {
        deptab: selectedDeployment.databaseEnabled ? 'database' : null,
      },
    })
  }

  if (
    selectedDeployment && deptab === 'database' &&
    !selectedDeployment.databaseEnabled
  ) {
    navigate({
      params: { deptab: selectedDeployment.logsEnabled ? 'logs' : null },
    })
  }

  const tab = deptab === 'logs' ? <LogsSection /> : <DatabaseSection />
  return (
    <>
      <PageHeader className='gap-4 bg-base-100'>
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
              class='select'
            >
              <option disabled>Select Deployment</option>
              {deployments.map((dep) => (
                <option key={dep.url} value={dep.url}>
                  {dep.url}
                </option>
              ))}
            </select>
          </div>
          <div class='tabs tabs-boxed'>
            <A
              {...selectedDeployment?.logsEnabled
                ? { params: { deptab: 'logs' } }
                : {}}
              class={`tab ${
                deptab === 'logs' && selectedDeployment?.logsEnabled
                  ? 'tab-active'
                  : ''
              } gap-2`}
            >
              <Logs class='w-4 h-4' /> Logs
            </A>
            <A
              {...selectedDeployment?.databaseEnabled
                ? { params: { deptab: 'database' } }
                : {}}
              class={`tab ${
                deptab === 'database' && selectedDeployment?.databaseEnabled
                  ? 'tab-active'
                  : ''
              } gap-2`}
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
