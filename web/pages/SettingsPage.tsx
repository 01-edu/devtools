import { A, navigate, url } from '@01edu/signal-router'

import { api } from '../lib/api.ts'
import { deployments, project } from '../lib/shared.tsx'
import {
  Check,
  ChevronRight,
  Cloud,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Users,
  X,
} from 'lucide-preact'
import { DialogModal } from '../components/Dialog.tsx'
import type { TargetedEvent } from 'preact'
import { effect, signal } from '@preact/signals'

// API Signals
const updateProject = api['PUT/api/project'].signal()
const updateDeployment = api['PUT/api/deployment'].signal()
const createDeployment = api['POST/api/deployment'].signal()
const getDeployment = api['GET/api/deployment'].signal()
const regenToken = api['POST/api/deployment/token/regenerate'].signal()

effect(() => {
  if (url.params.dep) {
    getDeployment.fetch({ url: url.params.dep })
  }
})

const navItems = [
  { id: 'project', label: 'Project', icon: Settings },
  { id: 'deployments', label: 'Deployments', icon: Cloud },
  { id: 'team', label: 'Team Members', icon: Users },
]
const formatDate = (d?: number | null) =>
  d ? new Date(d).toLocaleDateString() : undefined
const isEditing = (key: string) => url.params.editing === key

const rowClass =
  'flex justify-between items-center py-2 border-b border-base-300 last:border-0'
const inputXs =
  'input input-xs input-bordered w-full text-[11px] bg-base-100/50 h-7'
const btnXs = 'btn btn-xs btn-square join-item h-7 min-h-0'

const SettingsSidebar = () => (
  <aside class='w-64 h-[calc(100vh-64px)] bg-base-200 border-r border-base-300 flex flex-col'>
    <div class='p-4 border-b border-base-300'>
      <h2 class='text-sm font-semibold text-base-content/60 uppercase tracking-wider'>
        Settings
      </h2>
      <p class='text-xs text-base-content/40 mt-1 truncate'>
        {project.data?.name}
      </p>
    </div>
    <nav class='flex-1 p-2 overflow-y-auto'>
      <ul class='space-y-2'>
        {navItems.map((item) => {
          const active = (url.params.view || 'project') === item.id
          return (
            <li key={item.id}>
              <A
                params={{ view: item.id }}
                replace
                class={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group ${
                  active
                    ? 'bg-primary text-primary-content shadow-sm'
                    : 'hover:bg-base-300 text-base-content'
                }`}
              >
                <item.icon
                  class={`w-4 h-4 flex-shrink-0 ${
                    active ? '' : 'text-base-content/60'
                  }`}
                />
                <span class='flex-1 font-medium'>{item.label}</span>
                <ChevronRight
                  class={`w-4 h-4 transition-opacity ${
                    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                />
              </A>
            </li>
          )
        })}
      </ul>
    </nav>
    <div class='p-4 border-t border-base-300 flex-shrink-0'>
      <div class='flex items-center gap-2 text-xs text-base-content/40'>
        <div class='w-2 h-2 rounded-full bg-success' />
        <span>Connected</span>
      </div>
    </div>
  </aside>
)

const Layout = ({
  title,
  desc,
  actions,
  error,
  children,
}: {
  title: string
  desc: string
  actions?: preact.ComponentChildren
  error?: string | null
  children: preact.ComponentChildren
}) => (
  <div class='flex flex-col h-full min-h-0 pb-16'>
    <div class='border-b border-base-300 bg-base-100 px-8 py-6 flex items-center justify-between gap-4'>
      <div>
        <h1 class='text-xl font-semibold text-base-content'>{title}</h1>
        <p class='text-sm text-base-content/60 mt-1'>{desc}</p>
      </div>
      {actions}
    </div>
    <div class='flex-1 overflow-y-auto p-8 min-h-0'>
      <div class='max-w-2xl mx-auto space-y-6'>
        {error && (
          <div class='alert alert-error text-sm'>
            <X class='w-4 h-4' />
            <span>{error}</span>
          </div>
        )}
        {children}
      </div>
    </div>
  </div>
)

const Card = (
  { title, action, children }: {
    title: string
    action?: preact.ComponentChildren
    children: preact.ComponentChildren
  },
) => (
  <div class='bg-base-200 rounded-lg border border-base-300'>
    <div class='px-4 py-3 border-b border-base-300 flex justify-between items-center'>
      <h3 class='font-semibold text-sm'>{title}</h3>
      {action}
    </div>
    <div class='p-4'>{children}</div>
  </div>
)

const EditCard = (
  { title, editKey, saving, children }: {
    title: string
    editKey: string
    saving?: boolean
    children: preact.ComponentChildren
  },
) => (
  <div class='bg-base-200 rounded-lg border border-base-300'>
    <div class='px-4 py-3 border-b border-base-300 flex justify-between items-center'>
      <h3 class='font-semibold text-sm'>{title}</h3>
      {isEditing(editKey)
        ? (
          <div class='flex gap-2'>
            <A params={{ editing: null }} replace class='btn btn-ghost btn-xs'>
              <X class='w-3 h-3' />
            </A>
            <button
              type='submit'
              class='btn btn-primary btn-xs gap-1'
              disabled={saving}
            >
              {saving
                ? <Loader2 class='w-3 h-3 animate-spin' />
                : <Check class='w-3 h-3' />} Save
            </button>
          </div>
        )
        : (
          <A
            params={{ editing: editKey }}
            replace
            class='btn btn-ghost btn-xs gap-1'
          >
            <Pencil class='w-3 h-3' /> Edit
          </A>
        )}
    </div>
    <div class='p-4'>{children}</div>
  </div>
)

const Row = (
  { label, value }: { label: string; value?: string | number | null },
) => (
  <div class={rowClass}>
    <span class='text-base-content/60 text-sm'>{label}</span>
    <span class='text-sm font-medium'>{value ?? '–'}</span>
  </div>
)

const TextRow = (
  { label, name, value, editKey }: {
    label: string
    name: string
    value: string
    editKey: string
  },
) => (
  <div class={rowClass}>
    <span class='text-base-content/60 text-sm'>{label}</span>
    {isEditing(editKey)
      ? (
        <input
          type='text'
          name={name}
          defaultValue={value}
          class='input input-sm input-bordered w-48 text-sm'
        />
      )
      : <span class='text-sm font-medium'>{value || '–'}</span>}
  </div>
)

const ToggleRow = (
  { label, name, value, editKey }: {
    label: string
    name?: string
    value: boolean
    editKey: string
  },
) => (
  <div class={rowClass}>
    <span class='text-base-content/60 text-sm'>{label}</span>
    {isEditing(editKey)
      ? (
        <input
          type='checkbox'
          name={name}
          defaultChecked={value}
          class='toggle toggle-sm toggle-primary'
        />
      )
      : <span class='text-sm font-medium'>{value ? 'Yes' : 'No'}</span>}
  </div>
)

const Label = ({ text, desc }: { text: string; desc: string }) => (
  <div class='flex items-center gap-1.5'>
    <span class='text-xs text-base-content/60'>{text}</span>
    <span class='text-[10px] text-base-content/40'>• {desc}</span>
  </div>
)

const Input = (
  { name, value, editKey, placeholder, secret, visKey, mono }: {
    name: string
    value: string
    editKey: string
    placeholder?: string
    secret?: boolean
    visKey?: string
    mono?: boolean
  },
) => {
  const visible = visKey ? url.params[visKey] === 'true' : !secret
  return (
    <div class={secret ? 'join w-full' : ''}>
      <input
        type={secret && !visible ? 'password' : 'text'}
        name={name}
        defaultValue={value}
        readOnly={!isEditing(editKey)}
        class={`${inputXs} ${secret ? 'join-item' : ''} ${
          mono ? 'font-mono' : ''
        }`}
        placeholder={placeholder || (secret ? '••••••' : '')}
      />
      {secret && visKey && (
        <A
          params={{ [visKey]: visible ? null : 'true' }}
          replace
          class={btnXs}
          title={visible ? 'Hide' : 'Show'}
        >
          {visible ? <EyeOff class='w-3 h-3' /> : <Eye class='w-3 h-3' />}
        </A>
      )}
    </div>
  )
}

const Accordion = ({
  label,
  name,
  value,
  editKey,
  urlKey,
  hideOnEdit,
  children,
}: {
  label: string
  name: string
  value: boolean
  editKey: string
  urlKey: string
  hideOnEdit?: boolean
  children: preact.ComponentChildren
}) => {
  const param = url.params[urlKey]
  const enabled = param != null ? param === 'true' : value
  const editing = isEditing(editKey)
  const showChildren = enabled && !(hideOnEdit && editing)
  const onChange = (v: boolean) =>
    navigate({ params: { [urlKey]: String(v) }, replace: true })
  return (
    <div
      class={`border-b border-base-300 transition-all duration-200 ${
        enabled ? 'bg-base-300/50 rounded-lg -mx-2 px-2 my-1' : ''
      }`}
    >
      <div class='flex justify-between items-center py-2'>
        <span class='text-base-content/60 text-sm'>{label}</span>
        {editing
          ? (
            <input
              type='checkbox'
              name={name}
              checked={enabled}
              onChange={(e) => onChange(e.currentTarget.checked)}
              class='toggle toggle-sm toggle-primary'
            />
          )
          : <span class='text-sm font-medium'>{enabled ? 'Yes' : 'No'}</span>}
      </div>
      {showChildren && (
        <div class='pb-2 pt-2 px-3 mb-2 bg-base-300/60 rounded-md animate-in fade-in slide-in-from-top-1 duration-200'>
          {children}
        </div>
      )}
    </div>
  )
}

const ToolCard = (
  { title, desc, empty }: { title: string; desc: string; empty: string },
) => (
  <div class='p-3 bg-base-300 rounded-lg'>
    <h4 class='text-sm font-medium mb-2'>{title}</h4>
    <p class='text-xs text-base-content/60 mb-3'>{desc}</p>
    <div class='text-xs text-base-content/40 italic'>{empty}</div>
    <A
      params={{ tool: title.toLowerCase().replace(/\s/g, '-') }}
      class='btn btn-sm btn-outline mt-3 gap-1'
    >
      <Settings class='w-3 h-3' /> Add {title.split(' ').pop()}
    </A>
  </div>
)

const addDeploymentError = signal<string | null>(null)
const handleSubmit = async (e: TargetedEvent<HTMLFormElement>) => {
  e.preventDefault()
  const fd = new FormData(e.currentTarget)
  const projectId = project.data?.slug
  if (!projectId) return
  try {
    const depUrl = new URL(fd.get('url') as string).host
    await createDeployment.fetch({
      url: depUrl,
      projectId,
      logsEnabled: false,
      databaseEnabled: false,
      sqlEndpoint: null,
      sqlToken: null,
    })
    deployments.fetch({ project: projectId })
    navigate({
      params: { dialog: null },
      replace: true,
    })
  } catch (e) {
    addDeploymentError.value = e instanceof Error ? e.message : 'Unknown error'
  }
}
const AddDeploymentDialog = () => (
  <DialogModal id='add-deployment'>
    <h3 class='text-lg font-bold mb-4'>Add Deployment</h3>
    <form onSubmit={handleSubmit} class='space-y-4'>
      <div class='form-control w-full'>
        <label class='label'>
          <span class='label-text'>Deployment URL</span>
        </label>
        <input
          type='text'
          name='url'
          required
          placeholder='https://my-app.deno.dev'
          class='input input-bordered w-full'
        />
      </div>
      {(createDeployment.error || addDeploymentError.value) && (
        <div class='text-error text-xs px-1'>
          {createDeployment.error || addDeploymentError.value}
        </div>
      )}
      <div class='modal-action'>
        <A params={{ dialog: null }} class='btn btn-ghost'>Cancel</A>
        <button
          type='submit'
          class='btn btn-primary'
          disabled={!!createDeployment.pending}
        >
          {createDeployment.pending
            ? <Loader2 class='w-4 h-4 animate-spin' />
            : 'Add Deployment'}
        </button>
      </div>
    </form>
  </DialogModal>
)

function LogsTokenSection({ deploymentUrl }: { deploymentUrl: string }) {
  const visible = url.params['token-vis'] === 'true'
  const loading = getDeployment.pending || regenToken.pending

  const regenerate = async () => {
    if (!confirm('Regenerate token?')) return
    await regenToken.fetch({ url: deploymentUrl })
    getDeployment.fetch({ url: deploymentUrl })
  }

  return (
    <div class='space-y-1.5'>
      <Label text='Token' desc='auth for logs service' />
      <div class='join w-full'>
        <input
          type={visible ? 'text' : 'password'}
          readOnly
          value={getDeployment.data?.token || ''}
          class={`${inputXs} join-item font-mono`}
        />
        <A
          params={{ 'token-vis': visible ? null : 'true' }}
          replace
          class={`${btnXs} ${loading ? 'btn-disabled' : ''}`}
          title={visible ? 'Hide' : 'Show'}
        >
          {visible ? <EyeOff class='w-3 h-3' /> : <Eye class='w-3 h-3' />}
        </A>
        <button
          type='button'
          class={`${btnXs} ${loading ? 'btn-disabled' : ''}`}
          title='Regenerate'
          onClick={regenerate}
        >
          <RefreshCw class={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {(getDeployment.error || regenToken.error) && (
        <div class='text-error text-xs'>
          {(getDeployment.error || regenToken.error)?.message}
        </div>
      )}
    </div>
  )
}

// Pages
const handleProjectSubmit = async (e: TargetedEvent<HTMLFormElement>) => {
  e.preventDefault()
  if (!project.data) return
  const fd = new FormData(e.currentTarget)
  try {
    await updateProject.fetch({
      ...project.data,
      name: fd.get('name') as string,
      repositoryUrl: (fd.get('repositoryUrl') as string) || undefined,
      isPublic: fd.get('isPublic') === 'on',
    })
    project.fetch({ slug: project.data.slug })
    navigate({ params: { editing: null }, replace: true })
  } catch (e) {
    console.error(e)
  }
}
const ProjectSettingsPage = () => {
  const p = project.data, deps = deployments.data ?? []
  return (
    <Layout
      title='Project Settings'
      desc='Overview of project configuration and resources.'
      error={updateProject.error?.message}
    >
      <form onSubmit={handleProjectSubmit}>
        <EditCard
          title='Project Information'
          editKey='project'
          saving={!!updateProject.pending}
        >
          <TextRow
            label='Name'
            name='name'
            value={p?.name || ''}
            editKey='project'
          />
          <TextRow
            label='Repository'
            name='repositoryUrl'
            value={p?.repositoryUrl || ''}
            editKey='project'
          />
          <Row label='Slug' value={p?.slug} />
          <ToggleRow
            label='Public'
            name='isPublic'
            value={p?.isPublic ?? false}
            editKey='project'
          />
          <Row label='Created' value={formatDate(p?.createdAt)} />
          <Row label='Updated' value={formatDate(p?.updatedAt)} />
        </EditCard>
      </form>
      <Card title='Team'>
        <Row label='Team ID' value={p?.teamId} />
      </Card>
      <Card
        title={`Deployments (${deps.length})`}
        action={
          <A
            params={{ dialog: 'add-deployment' }}
            class='btn btn-ghost btn-xs gap-1'
          >
            <Plus class='w-4 h-4' /> Add
          </A>
        }
      >
        {deps.length === 0
          ? (
            <p class='text-sm text-base-content/40'>
              No deployments configured.
            </p>
          )
          : (
            <div class='space-y-2'>
              {deps.map((dep) => (
                <A
                  key={dep.url}
                  params={{ view: 'deployments', dep: dep.url }}
                  replace
                  class='flex items-center justify-between py-2 border-b border-base-300 last:border-0 hover:bg-base-300 rounded px-2 -mx-2 cursor-pointer transition-colors'
                >
                  <span class='text-sm font-mono truncate max-w-xs'>
                    {dep.url}
                  </span>
                  <div class='flex gap-2'>
                    {dep.logsEnabled && (
                      <span class='badge badge-sm badge-success'>Logs</span>
                    )}
                    {dep.databaseEnabled && (
                      <span class='badge badge-sm badge-info'>DB</span>
                    )}
                  </div>
                </A>
              ))}
            </div>
          )}
      </Card>
    </Layout>
  )
}

const handleDeploymentSubmit = async (e: TargetedEvent<HTMLFormElement>) => {
  e.preventDefault()
  const dep = getDeployment.data
  if (!dep) return
  const { logs, db } = url.params
  const logsEnabled = logs != null
    ? logs === 'true'
    : (dep?.logsEnabled ?? false)
  const databaseEnabled = db != null
    ? db === 'true'
    : (dep?.databaseEnabled ?? false)
  const fd = new FormData(e.currentTarget)
  try {
    await updateDeployment.fetch({
      url: dep.url,
      projectId: project.data!.slug,
      logsEnabled,
      databaseEnabled,
      sqlEndpoint: (fd.get('sql-endpoint') as string) || undefined,
      sqlToken: (fd.get('sql-token') as string) || undefined,
    })
    getDeployment.fetch({ url: dep.url })
    navigate({
      params: { editing: null, logs: null, db: null },
      replace: true,
    })
  } catch (e) {
    console.error(e)
  }
}
const DeploymentsSettingsPage = () => {
  const deps = deployments.data ?? [],
    dep = getDeployment.data,
    selectedUrl = url.params.dep

  if (!selectedUrl && deps.length > 0) {
    navigate({ params: { dep: deps[0].url }, replace: true })
    return null
  }

  return (
    <Layout
      title='Deployments'
      desc='Manage deployment configurations and tools.'
      error={updateDeployment.error?.message}
      actions={
        <div class='flex items-center gap-2'>
          <A
            params={{ dialog: 'add-deployment' }}
            class='btn btn-sm btn-primary gap-1'
          >
            <Plus class='w-4 h-4' /> New
          </A>
          {deps.length > 0 && (
            <select
              class='select select-bordered select-sm w-full max-w-xs'
              value={selectedUrl || ''}
              defaultValue={selectedUrl || ''}
              onChange={(e) => {
                navigate({
                  params: {
                    dep: e.currentTarget.value,
                    editing: null,
                  },
                  replace: true,
                })
              }}
            >
              <option disabled value=''>Select deployment</option>
              {deps.map((d) => (
                <option key={d.url} value={d.url}>{d.url}</option>
              ))}
            </select>
          )}
        </div>
      }
    >
      {dep && (
        <form onSubmit={handleDeploymentSubmit}>
          <EditCard
            title='Deployment Configuration'
            editKey='deployment'
            saving={!!updateDeployment.pending}
          >
            <div class='space-y-3'>
              <Row label='URL' value={dep.url} />
              <Accordion
                label='Logs Enabled'
                name='logsEnabled'
                value={dep.logsEnabled}
                editKey='deployment'
                urlKey='logs'
                hideOnEdit
              >
                <LogsTokenSection deploymentUrl={dep.url} />
              </Accordion>
              <Accordion
                label='Database Enabled'
                name='databaseEnabled'
                value={dep.databaseEnabled}
                editKey='deployment'
                urlKey='db'
              >
                <div class='space-y-2'>
                  <Label text='SQL Endpoint' desc='database connection URL' />
                  <Input
                    name='sql-endpoint'
                    value={dep.sqlEndpoint || ''}
                    editKey='deployment'
                    placeholder='https://...'
                    mono
                  />
                  <Label text='SQL Token' desc='auth token for database' />
                  <Input
                    name='sql-token'
                    value={dep.sqlToken || ''}
                    editKey='deployment'
                    secret
                    visKey='sql-vis'
                  />
                </div>
              </Accordion>
              <Row label='Created' value={formatDate(dep.createdAt)} />
              <Row label='Updated' value={formatDate(dep.updatedAt)} />
            </div>
          </EditCard>
        </form>
      )}
      {dep && (
        <Card title='Tools'>
          <div class='space-y-4'>
            <ToolCard
              title='Column Encryptors'
              desc='Add JS encryptors to encrypt specific columns.'
              empty='No encryptors configured.'
            />
            <ToolCard
              title='Data Transformers'
              desc='Transform data before displaying or exporting.'
              empty='No transformers configured.'
            />
          </div>
        </Card>
      )}
      {!dep && deps.length > 0 && (
        <div class='text-center py-8 text-base-content/40'>
          Select a deployment to view its configuration.
        </div>
      )}
      {getDeployment.pending && (
        <div class='text-center py-8 text-base-content/40'>
          Loading deployment...
        </div>
      )}
    </Layout>
  )
}

const TeamSettingsPage = () => (
  <Layout title='Team Members' desc='Manage team access and permissions.'>
    <div class='text-base-content/40 text-sm'>
      Team settings content will go here.
    </div>
  </Layout>
)

const views = {
  project: ProjectSettingsPage,
  deployments: DeploymentsSettingsPage,
  team: TeamSettingsPage,
} as const

export const SettingsPage = () => {
  const { view = 'project' } = url.params
  if (!project.data) {
    return (
      <div class='flex items-center justify-center h-full bg-base-100'>
        <Loader2 class='w-8 h-8 animate-spin text-primary' />
      </div>
    )
  }
  const Content = views[view as keyof typeof views] ?? views.project
  return (
    <div class='flex h-full overflow-hidden bg-base-100'>
      <SettingsSidebar />
      <div class='flex-1 flex flex-col overflow-hidden'>
        <Content />
      </div>
      {project.data && <AddDeploymentDialog />}
    </div>
  )
}
