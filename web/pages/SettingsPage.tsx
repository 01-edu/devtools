import { useState } from 'preact/hooks'
import { A, navigate, url } from '@01edu/signal-router'
import { api } from '../lib/api.ts'
import { deployments, project } from '../lib/shared.tsx'
import { Check, ChevronRight, Cloud, Eye, EyeOff, Loader2, Pencil, Plus, RefreshCw, Settings, Users, X } from 'lucide-preact'
import { DialogModal } from '../components/Dialog.tsx'
import type { TargetedEvent } from 'preact'

// type Deployment = ApiOutput['GET/api/project/deployments'][number]
// type User = ApiOutput['GET/api/users'][number]

// const users = api['GET/api/users'].signal()
// users.fetch()

// const teams = api['GET/api/teams'].signal()
// teams.fetch()

// const team = api['GET/api/team'].signal()

const navItems = [
  { id: 'project', label: 'Project', icon: Settings },
  { id: 'deployments', label: 'Deployments', icon: Cloud },
  { id: 'team', label: 'Team Members', icon: Users },
]

type NavItem = (typeof navItems)[number]

const SidebarHeader = () => (
  <div class='p-4 border-b border-base-300'>
    <h2 class='text-sm font-semibold text-base-content/60 uppercase tracking-wider'>
      Settings
    </h2>
    <p class='text-xs text-base-content/40 mt-1 truncate'>
      {project.data?.name}
    </p>
  </div>
)

const SidebarNavItem = (
  { item, isActive }: { item: NavItem; isActive: boolean },
) => (
  <li>
    <A
      params={{ view: item.id }}
      replace
      class={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group ${
        isActive
          ? 'bg-primary text-primary-content shadow-sm'
          : 'hover:bg-base-300 text-base-content'
      }`}
    >
      <item.icon
        class={`w-4 h-4 flex-shrink-0 ${
          isActive ? '' : 'text-base-content/60'
        }`}
      />
      <span class='flex-1 font-medium'>{item.label}</span>
      <ChevronRight
        class={`w-4 h-4 transition-opacity ${
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      />
    </A>
  </li>
)

const SidebarNav = () => (
  <nav class='flex-1 p-2 overflow-y-auto'>
    <ul class='space-y-2'>
      {navItems.map((item) => (
        <SidebarNavItem
          key={item.id}
          item={item}
          isActive={(url.params.view || 'project') === item.id}
        />
      ))}
    </ul>
  </nav>
)

const SidebarFooter = () => (
  <div class='p-4 border-t border-base-300 flex-shrink-0'>
    <div class='flex items-center gap-2 text-xs text-base-content/40'>
      <div class='w-2 h-2 rounded-full bg-success' />
      <span>Connected</span>
    </div>
  </div>
)

const SettingsSidebar = () => (
  <aside class='w-64 h-[calc(100vh-64px)] bg-base-200 border-r border-base-300 flex flex-col'>
    <SidebarHeader />
    <SidebarNav />
    <SidebarFooter />
  </aside>
)

const PageHeader = (
  { title, description, children }: {
    title: string
    description: string
    children?: preact.ComponentChildren
  },
) => (
  <div class='border-b border-base-300 bg-base-100 px-8 py-6 flex flex-row items-center justify-between gap-4'>
    <div>
      <h1 class='text-xl font-semibold text-base-content'>{title}</h1>
      <p class='text-sm text-base-content/60 mt-1'>{description}</p>
    </div>
    {children}
  </div>
)

const InfoRow = ({ label, value }: { label: string; value: string | number | undefined | null }) => (
  <div class='flex justify-between py-2 border-b border-base-300 last:border-0'>
    <span class='text-base-content/60 text-sm'>{label}</span>
    <span class='text-sm font-medium'>{value ?? '–'}</span>
  </div>
)

const Card = ({ title, action, children }: { title: string; action?: preact.ComponentChildren; children: preact.ComponentChildren }) => (
  <div class='bg-base-200 rounded-lg border border-base-300'>
    <div class='px-4 py-3 border-b border-base-300 flex justify-between items-center'>
      <h3 class='font-semibold text-sm'>{title}</h3>
      {action}
    </div>
    <div class='p-4'>{children}</div>
  </div>
)

const EditableRow = (
  { label, name, value, editing }: { label: string; name: string; value: string; editing: boolean },
) => (
  <div class='flex justify-between items-center py-2 border-b border-base-300 last:border-0'>
    <span class='text-base-content/60 text-sm'>{label}</span>
    {editing ? (
      <input
        type='text'
        name={name}
        defaultValue={value}
        class='input input-sm input-bordered w-48 text-sm'
      />
    ) : (
      <span class='text-sm font-medium'>{value || '–'}</span>
    )}
  </div>
)

function AddDeploymentDialog({ projectId }: { projectId: string }) {
  const { dialog } = url.params
  if (dialog !== 'add-deployment') return null

  const handleSubmit = async (e: TargetedEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    let deploymentUrl = formData.get('url') as string
    
    // Sanitize input to get domain only
    try {
      const url = new URL(deploymentUrl.match(/^https?:\/\//) ? deploymentUrl : `https://${deploymentUrl}`)
      deploymentUrl = url.host
    } catch {
      deploymentUrl = deploymentUrl.replace(/^https?:\/\//, '').split('/')[0]
    }
    
    try {
      await api['POST/api/deployment'].fetch({
        url: deploymentUrl,
        projectId: projectId,
        logsEnabled: false,
        databaseEnabled: false,
        sqlEndpoint: null,
        sqlToken:null
      })
      navigate({ params: { dialog: null, view: 'deployments', url: deploymentUrl }, replace: true })
      deployments.fetch({ project: projectId })
    } catch (err) {
      console.error(err)
      // Ideally show toast here
    }
  }

  return (
    <DialogModal id='add-deployment'>
      <div class='flex justify-between items-center mb-4'>
        <h3 class='text-lg font-bold'>Add Deployment</h3>
      </div>
      <form onSubmit={handleSubmit} class='space-y-4'>
        <div class='form-control w-full'>
          <label class='label'>
            <span class='label-text'>Deployment</span>
            <span class='label-text-alt text-base-content/60'>Domain only (e.g. my-app.deno.dev)</span>
          </label>
          <input
            type='text'
            name='url'
            required
            placeholder='my-app.deno.dev'
            class='input input-bordered w-full'
          />
        </div>
        <div class='modal-action'>
          <A params={{ dialog: null }} class='btn btn-ghost'>Cancel</A>
          <button type='submit' class='btn btn-primary'>Add Deployment</button>
        </div>
      </form>
    </DialogModal>
  )
}

function LogsTokenSection({ deploymentUrl }: { deploymentUrl: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)

  const fetchToken = async () => {
    setLoading(true)
    try {
      const dep = await api['GET/api/deployment'].fetch({ url: deploymentUrl })
      if (dep.token) setToken(dep.token)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const regenerateToken = async () => {
    if (!confirm('Are you sure? This will invalidate the existing token.')) return
    setLoading(true)
    try {
      const dep = await api['POST/api/deployment/token/regenerate'].fetch({ url: deploymentUrl })
      if (dep.token) setToken(dep.token)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleVisibility = () => {
    if (!visible && !token) {
      fetchToken()
    }
    setVisible(!visible)
  }

  return (
    <div class='form-control w-full'>
      <label class='label'>
        <span class='label-text'>Logs Token</span>
        <span class='label-text-alt text-base-content/60'>
          Token for authentication with the logs service
        </span>
      </label>
      <div class='join w-full'>
        <input
          type='text'
          readOnly
          value={visible ? (token || 'Loading...') : '••••••••••••••••••••••••••••••••'}
          class='input input-bordered join-item w-full font-mono text-sm'
        />
        <button
          type='button'
          class='btn btn-square join-item'
          onClick={toggleVisibility}
          disabled={loading}
        >
          {visible ? <EyeOff class='w-4 h-4' /> : <Eye class='w-4 h-4' />}
        </button>
        <button
          type='button'
          class='btn join-item'
          onClick={regenerateToken}
          disabled={loading}
          title='Regenerate Token'
        >
          <RefreshCw class={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  )
}

const ProjectSettingsPage = () => {
  const p = project.data
  const deps = deployments.data ?? []
  const { editing, saving } = url.params
  const isEditing = editing === 'project'
  const isSaving = saving === 'true'

  const handleSubmit = async (e: TargetedEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!p) return

    navigate({ params: { saving: 'true' }, replace: true })
    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const repositoryUrl = formData.get('repositoryUrl') as string
    const isPublic = formData.get('isPublic') === 'on'

    try {
      await api['PUT/api/project'].fetch({
        ...p,
        name,
        repositoryUrl: repositoryUrl || undefined,
        isPublic,
      })
      project.fetch({ slug: p.slug })
      navigate({ params: { editing: null, saving: null }, replace: true })
    } catch (err) {
      console.error(err)
      navigate({ params: { saving: null }, replace: true })
    }
  }

  return (
    <div class='flex flex-col h-full pb-16'>
      <PageHeader
        title='Project Settings'
        description='Overview of project configuration and resources.'
      />
      <div class='flex-1 overflow-y-auto p-8'>
        <div class='max-w-2xl mx-auto space-y-6'>
          <form onSubmit={handleSubmit}>
            <div class='bg-base-200 rounded-lg border border-base-300'>
              <div class='px-4 py-3 border-b border-base-300 flex justify-between items-center'>
                <h3 class='font-semibold text-sm'>Project Information</h3>
                {isEditing ? (
                  <div class='flex gap-2'>
                    <A
                      params={{ editing: null }}
                      replace
                      class='btn btn-ghost btn-xs'
                    >
                      <X class='w-3 h-3' />
                    </A>
                    <button
                      type='submit'
                      class='btn btn-primary btn-xs gap-1'
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 class='w-3 h-3 animate-spin' /> : <Check class='w-3 h-3' />}
                      Save
                    </button>
                  </div>
                ) : (
                  <A params={{ editing: 'project' }} replace class='btn btn-ghost btn-xs gap-1'>
                    <Pencil class='w-3 h-3' /> Edit
                  </A>
                )}
              </div>
              <div class='p-4'>
                <EditableRow label='Name' name='name' value={p?.name || ''} editing={isEditing} />
                <EditableRow label='Repository' name='repositoryUrl' value={p?.repositoryUrl || ''} editing={isEditing} />
                <InfoRow label='Slug' value={p?.slug} />
                <div class='flex justify-between items-center py-2 border-b border-base-300'>
                  <span class='text-base-content/60 text-sm'>Visibility</span>
                  {isEditing ? (
                    <label class='flex items-center gap-2 cursor-pointer'>
                      <span class='text-sm'>{p?.isPublic ? 'Public' : 'Private'}</span>
                      <input
                        type='checkbox'
                        name='isPublic'
                        defaultChecked={p?.isPublic}
                        class='toggle toggle-sm toggle-primary'
                      />
                    </label>
                  ) : (
                    <span class='text-sm font-medium'>{p?.isPublic ? 'Public' : 'Private'}</span>
                  )}
                </div>
                <InfoRow label='Created' value={p?.createdAt ? new Date(p.createdAt).toLocaleDateString() : undefined} />
                <InfoRow label='Updated' value={p?.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : undefined} />
              </div>
            </div>
          </form>

          <Card title='Team'>
            <InfoRow label='Team ID' value={p?.teamId} />
          </Card>

          <Card
            title={`Deployments (${deps.length})`}
            action={
              <A params={{ dialog: 'add-deployment' }} class='btn btn-ghost btn-xs gap-1'>
                <Plus class='w-4 h-4' /> Add
              </A>
            }
          >
            {deps.length === 0 ? (
              <p class='text-sm text-base-content/40'>No deployments configured.</p>
            ) : (
              <div class='space-y-2'>
                {deps.map((dep) => (
                  <A
                    key={dep.url}
                    params={{ view: 'deployments', url: dep.url }}
                    replace
                    class='flex items-center justify-between py-2 border-b border-base-300 last:border-0 hover:bg-base-300 rounded px-2 -mx-2 cursor-pointer transition-colors'
                  >
                    <span class='text-sm font-mono truncate max-w-xs'>{dep.url}</span>
                    <div class='flex gap-2'>
                      {dep.logsEnabled && <span class='badge badge-sm badge-success'>Logs</span>}
                      {dep.databaseEnabled && <span class='badge badge-sm badge-info'>DB</span>}
                    </div>
                  </A>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

const DeploymentsSettingsPage = () => {
  const deps = deployments.data ?? []
  const { url: selectedUrl, editing, saving } = url.params
  const selectedDep = deps.find((d) => d.url === selectedUrl)
  const isEditing = editing === 'deployment'
  const isSaving = saving === 'true'

  const handleSubmit = async (e: TargetedEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedDep || !project.data) return

    navigate({ params: { saving: 'true' }, replace: true })
    const formData = new FormData(e.currentTarget)
    const logsEnabled = formData.get('logsEnabled') === 'on'
    const databaseEnabled = formData.get('databaseEnabled') === 'on'
    const sqlEndpoint = formData.get('sqlEndpoint') as string
    const sqlToken = formData.get('sqlToken') as string

    try {
      await api['PUT/api/deployment'].fetch({
        url: selectedDep.url,
        projectId: project.data.slug,
        logsEnabled,
        databaseEnabled,
        sqlEndpoint: sqlEndpoint || undefined,
        sqlToken: sqlToken || undefined,
      })
      deployments.fetch({ project: project.data.slug })
      navigate({ params: { editing: null, saving: null }, replace: true })
    } catch (err) {
      console.error(err)
      navigate({ params: { saving: null }, replace: true })
    }
  }

  return (
    <div class='flex flex-col h-full min-h-0 pb-16'>
      <PageHeader
        title='Deployments'
        description='Manage deployment configurations and tools.'
      >
        <div class='flex items-center gap-2'>
          <A params={{ dialog: 'add-deployment' }} class='btn btn-sm btn-primary gap-1'>
            <Plus class='w-4 h-4' /> New
          </A>
        {deps.length > 0 && (
          <select
            class='select select-bordered select-sm w-full max-w-xs'
            value={selectedUrl || ''}
            onChange={(e) =>
              navigate({
                params: { url: e.currentTarget.value, editing: null },
                replace: true,
              })}
          >
            <option disabled value=''>Select deployment</option>
            {deps.map((dep) => <option key={dep.url} value={dep.url}>{dep.url}</option>)}
          </select>
        )}
        </div>
      </PageHeader>
      <div class='flex-1 overflow-y-auto p-8 min-h-0 '>
        <div class='max-w-2xl mx-auto space-y-6'>
          {selectedDep && (
            <form onSubmit={handleSubmit}>
              <div class='bg-base-200 rounded-lg border border-base-300'>
                <div class='px-4 py-3 border-b border-base-300 flex justify-between items-center'>
                  <h3 class='font-semibold text-sm'>Deployment Configuration</h3>
                  {isEditing ? (
                    <div class='flex gap-2'>
                      <A params={{ editing: null }} replace class='btn btn-ghost btn-xs'>
                        <X class='w-3 h-3' />
                      </A>
                      <button type='submit' class='btn btn-primary btn-xs gap-1' disabled={isSaving}>
                        {isSaving ? <Loader2 class='w-3 h-3 animate-spin' /> : <Check class='w-3 h-3' />}
                        Save
                      </button>
                    </div>
                  ) : (
                    <A params={{ editing: 'deployment' }} replace class='btn btn-ghost btn-xs gap-1'>
                      <Pencil class='w-3 h-3' /> Edit
                    </A>
                  )}
                </div>
                <div class='p-4 space-y-3'>
                  <InfoRow label='URL' value={selectedDep.url} />
                  
                  <div class='flex justify-between items-center py-2 border-b border-base-300'>
                    <span class='text-base-content/60 text-sm'>Logs Enabled</span>
                    {isEditing ? (
                      <input
                        type='checkbox'
                        name='logsEnabled'
                        defaultChecked={selectedDep.logsEnabled}
                        class='toggle toggle-sm toggle-primary'
                      />
                    ) : (
                      <span class='text-sm font-medium'>{selectedDep.logsEnabled ? 'Yes' : 'No'}</span>
                    )}
                  </div>

                  <div class='flex justify-between items-center py-2 border-b border-base-300'>
                    <span class='text-base-content/60 text-sm'>Database Enabled</span>
                    {isEditing ? (
                      <input
                        type='checkbox'
                        name='databaseEnabled'
                        defaultChecked={selectedDep.databaseEnabled}
                        class='toggle toggle-sm toggle-primary'
                      />
                    ) : (
                      <span class='text-sm font-medium'>{selectedDep.databaseEnabled ? 'Yes' : 'No'}</span>
                    )}
                  </div>

                  {isEditing && (
                    <>
                      <div class='flex justify-between items-center py-2 border-b border-base-300'>
                        <span class='text-base-content/60 text-sm'>SQL Endpoint</span>
                        <input
                          type='text'
                          name='sqlEndpoint'
                          defaultValue={selectedDep.sqlEndpoint || ''}
                          class='input input-sm input-bordered w-48 text-sm font-mono'
                          placeholder='https://...'
                        />
                      </div>
                      <div class='flex justify-between items-center py-2 border-b border-base-300'>
                        <span class='text-base-content/60 text-sm'>SQL Token</span>
                        <input
                          type='password'
                          name='sqlToken'
                          defaultValue={selectedDep.sqlToken || ''}
                          class='input input-sm input-bordered w-48 text-sm'
                          placeholder='••••••'
                        />
                      </div>
                    </>
                  )}

                  {selectedDep.logsEnabled && (
                    <LogsTokenSection deploymentUrl={selectedDep.url} />
                  )}

                  <InfoRow label='Created' value={selectedDep.createdAt ? new Date(selectedDep.createdAt).toLocaleDateString() : undefined} />
                  <InfoRow label='Updated' value={selectedDep.updatedAt ? new Date(selectedDep.updatedAt).toLocaleDateString() : undefined} />
                </div>
              </div>
            </form>
          )}

          {/* Tools Section */}
          {selectedDep && (
            <Card title='Tools'>
              <div class='space-y-4'>
                <div class='p-3 bg-base-300 rounded-lg'>
                  <h4 class='text-sm font-medium mb-2'>Column Encryptors</h4>
                  <p class='text-xs text-base-content/60 mb-3'>
                    Add JS encryptors to encrypt specific columns in your database tables.
                  </p>
                  <div class='text-xs text-base-content/40 italic'>
                    No encryptors configured. Click to add one.
                  </div>
                  <button type='button' class='btn btn-sm btn-outline mt-3 gap-1'>
                    <Settings class='w-3 h-3' /> Add Encryptor
                  </button>
                </div>

                <div class='p-3 bg-base-300 rounded-lg'>
                  <h4 class='text-sm font-medium mb-2'>Data Transformers</h4>
                  <p class='text-xs text-base-content/60 mb-3'>
                    Transform data before displaying or exporting.
                  </p>
                  <div class='text-xs text-base-content/40 italic'>
                    No transformers configured.
                  </div>
                  <button type='button' class='btn btn-sm btn-outline mt-3 gap-1'>
                    <Settings class='w-3 h-3' /> Add Transformer
                  </button>
                </div>
              </div>
            </Card>
          )}

          {!selectedDep && deps.length > 0 && (
            <div class='text-center py-8 text-base-content/40'>
              Select a deployment to view its configuration.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const TeamSettingsPage = () => (
  <div class='flex flex-col h-full'>
    <PageHeader
      title='Team Members'
      description='Manage team access and permissions.'
    />
    <div class='flex-1 overflow-y-auto p-8'>
      <div class='max-w-2xl'>
        <div class='text-base-content/40 text-sm'>
          Team settings content will go here.
        </div>
      </div>
    </div>
  </div>
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
      {project.data && <AddDeploymentDialog projectId={project.data.slug} />}
    </div>
  )
}
