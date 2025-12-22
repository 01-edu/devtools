import { signal, useSignal } from '@preact/signals'
import { A, navigate } from '@01edu/signal-router'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Folder,
  Lock,
  LucideIcon,
  Plus,
  Search,
  Settings,
} from 'lucide-preact'
import { Dialog, DialogModal } from '../components/Dialog.tsx'
import { url } from '@01edu/signal-router'
import { JSX } from 'preact'
import { user } from '../lib/session.ts'
import { api, ApiOutput } from '../lib/api.ts'
import { PageContent, PageHeader, PageLayout } from '../components/Layout.tsx'

type Project = ApiOutput['GET/api/projects'][number]
type User = ApiOutput['GET/api/users'][number]
type Team = ApiOutput['GET/api/teams'][number]

const users = api['GET/api/users'].signal()
users.fetch()

const teams = api['GET/api/teams'].signal()
teams.fetch()

const projects = api['GET/api/projects'].signal()
projects.fetch()

const toastSignal = signal<{ message: string; type: 'info' | 'error' } | null>(
  null,
)

const slugify = (str: string) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')

async function saveProject(
  data: {
    name: string
    teamId: string
    slug?: string
    repositoryUrl?: string
    isPublic?: boolean
  },
) {
  let { slug, name, teamId, repositoryUrl, isPublic } = data
  const fetcher = slug ? api['PUT/api/project'] : api['POST/api/project']

  let finalSlug = slug || slugify(name)
  if (!slug) {
    const base = finalSlug
    let suffix = ''
    do {
      finalSlug = base + suffix
      suffix = suffix ? String(Number(suffix) + 1) : '0'
    } while (projects.data?.some((p) => p.slug === finalSlug))
    slug = finalSlug
  }
  try {
    await fetcher.fetch({
      slug: finalSlug,
      name,
      teamId,
      repositoryUrl,
      isPublic: isPublic ?? false,
    })
    projects.fetch()
    navigate({ params: { dialog: null, slug: null }, replace: true })
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), 'error')
  }
}

async function saveTeam(e: Event, teamId?: string) {
  e.preventDefault()
  const form = e.currentTarget as HTMLFormElement
  const formData = new FormData(form)
  const name = formData.get('name') as string

  try {
    if (teamId) {
      const team = teams.data?.find((t) => t.teamId === teamId)
      if (!team) throw new Error('Team not found')
      await api['PUT/api/team'].fetch({ ...team, teamName: name })
      toast(`Team "${name}" updated.`, 'info')
    } else {
      const newTeamId = formData.get('teamId') as string
      if (!newTeamId || !name) {
        toast('Team ID and name are required.', 'error')
        return
      }

      if (teams.data?.some((t) => t.teamId === newTeamId)) {
        toast(`Team ID "${newTeamId}" already exists.`, 'error')
        return
      }

      await api['POST/api/teams'].fetch({ teamId: newTeamId, teamName: name })
      toast(`Team "${name}" created.`, 'info')
      form.reset()
    }
    teams.fetch()
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), 'error')
  }
}

function toast(message: string, type: 'info' | 'error' = 'info') {
  toastSignal.value = { message, type }
  setTimeout(() => (toastSignal.value = null), 3000)
}

async function deleteProject(slug: string) {
  try {
    await api['DELETE/api/project'].fetch({ slug: slug })
    toast('Project deleted.', 'info')
    projects.fetch()
    navigate({ params: { dialog: null, id: null, key: null }, replace: true })
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), 'error')
  }
}

async function deleteTeam(id: string) {
  try {
    await api['DELETE/api/team'].fetch({ teamId: id })
    toast('Team deleted.', 'info')
    teams.fetch()
    navigate({ params: { dialog: null, id: null, key: null }, replace: true })
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), 'error')
  }
}

async function addUserToTeam(user: User, team: Team) {
  if (team.teamMembers.includes(user.userEmail)) return
  const updatedMembers = [...team.teamMembers, user.userEmail]
  try {
    await api['PUT/api/team'].fetch({
      ...team,
      teamMembers: updatedMembers,
    })
    toast(`${user.userFullName} added to ${team.teamName}.`)
    teams.fetch()
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), 'error')
  }
}

async function removeUserFromTeam(user: User, team: Team) {
  const updatedMembers = team.teamMembers.filter((email) =>
    email !== user.userEmail
  )
  if (updatedMembers.length === team.teamMembers.length) return
  try {
    await api['PUT/api/team'].fetch({
      ...team,
      teamMembers: updatedMembers,
    })
    toast(`${user.userFullName} removed from ${team.teamName}.`)
    teams.fetch()
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), 'error')
  }
}

const FormField = (
  { label, children }: { label: string; children: JSX.Element | JSX.Element[] },
) => (
  <label class='form-control w-full'>
    <span class='label label-text text-sm'>{label}</span>
    {children}
  </label>
)
const SectionTitle = ({ title, count }: { title: string; count: number }) => (
  <div class='flex items-center gap-3 mb-4 sm:mb-6'>
    <h2 class='text-lg sm:text-xl font-medium text-text'>{title}</h2>
    <span class='text-sm text-text2 bg-surface2 px-2.5 py-1 rounded-full'>
      {count}
    </span>
  </div>
)

const EmptyState = (
  { icon: Icon, title, subtitle }: {
    icon: LucideIcon
    title: string
    subtitle?: string
  },
) => (
  <div class='flex flex-col items-center justify-center py-20'>
    <Icon class='w-12 h-12 text-text2 mb-4' />
    <p class='text-text2 text-center'>{title}</p>
    {subtitle && <p class='text-text3 text-sm mt-1'>{subtitle}</p>}
  </div>
)

const ProjectCard = (
  { project, team }: { project: Project; team: Team },
) => {
  console.log(project)
  console.log(team)

  const isMember = team.teamMembers.includes(user.data?.userEmail || '')
  return (
    <A
      key={project.slug}
      href={isMember ? `/projects/${project.slug}` : undefined}
      class={'block hover:no-underline w-full h-18 ' +
        (isMember ? '' : 'pointer-events-none')}
    >
      <article class='card bg-base-200 border border-base-300 hover:bg-base-300 transition-colors h-full'>
        <div class='card-body p-4 h-full flex-row items-center gap-4'>
          <div class='flex-1 min-w-0 flex flex-col justify-center'>
            <h3
              class='font-semibold text-base-content text-base leading-tight truncate'
              title={project.name}
            >
              {project.name.length > 25
                ? project.name.slice(0, 22) + '…'
                : project.name}
            </h3>
            <div class='flex items-center gap-3 mt-1 text-xs text-base-content/70'>
              <span class='font-mono truncate'>{project.slug}</span>
              <div class='flex items-center gap-1 flex-shrink-0'>
                <Calendar class='w-3.5 h-3.5' />
                <span>
                  {project.createdAt &&
                    new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          {isMember
            ? (
              <ArrowRight class='w-5 h-5 text-primary flex-shrink-0 group-hover:translate-x-1 transition-transform duration-200' />
            )
            : <Lock class='w-5 h-5 text-base-content/70 flex-shrink-0' />}
        </div>
      </article>
    </A>
  )
}

const Toast = () => {
  if (!toastSignal.value) return null
  return (
    <div class='fixed bottom-4 right-4 bg-surface shadow-lg rounded-lg p-4 text-sm flex items-center gap-3 z-50'>
      {toastSignal.value.type === 'error' && (
        <AlertTriangle class='w-5 h-5 text-danger' />
      )}
      <span class='text-text'>{toastSignal.value.message}</span>
    </div>
  )
}

const TeamMembersRow = ({ user, team }: { user: User; team: Team }) => (
  <tr class='border-b border-divider'>
    <td class='py-3'>
      <div class='font-medium truncate'>{user.userFullName}</div>
      <div class='text-text2 truncate'>{user.userEmail}</div>
    </td>
    <td class='py-3'>{user.isAdmin ? 'Admin' : 'Member'}</td>
    <td class='py-3 text-right'>
      <input
        type='checkbox'
        class='toggle toggle-sm toggle-primary'
        checked={team.teamMembers.includes(user.userEmail)}
        onChange={(e) => {
          if ((e.target as HTMLInputElement).checked) {
            addUserToTeam(user, team)
          } else removeUserFromTeam(user, team)
        }}
      />
    </td>
  </tr>
)

const TeamProjectsRow = ({ project }: { project: Project }) => (
  <tr class='border-b border-divider'>
    <td class='py-3 font-medium truncate'>{project.name}</td>
    <td class='py-3 text-text2 truncate'>{project.slug}</td>
    <td class='py-3 text-text2 whitespace-nowrap'>
      {project.createdAt && new Date(project.createdAt).toLocaleDateString()}
    </td>
    <td class='py-3 text-right flex gap-2 justify-end'>
      <A
        params={{ dialog: 'edit-project', slug: project.slug }}
        class='btn btn-ghost btn-xs'
      >
        Edit
      </A>
      <A
        params={{ dialog: 'delete', id: project.slug, key: 'project' }}
        class='btn btn-ghost btn-xs text-danger'
      >
        Delete
      </A>
    </td>
  </tr>
)

const DialogSectionTitle = (props: JSX.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 class='text-sm font-medium text-text2 mb-3' {...props} />
)

const DialogTitle = (props: JSX.HTMLAttributes<HTMLHeadingElement>) => (
  <>
    <form method='dialog'>
      <button
        type='submit'
        class='btn btn-sm btn-circle btn-ghost absolute right-2 top-2'
      >
        ✕
      </button>
    </form>
    <h3 class='text-lg font-semibold mb-4' {...props} />
  </>
)

function ProjectDialog() {
  const { dialog, slug } = url.params
  const isEdit = dialog === 'edit-project'
  const project = isEdit
    ? projects.data?.find((p) => p.slug === slug)
    : undefined

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    const name = formData.get('name') as string
    const teamId = formData.get('teamId') as string
    const repositoryUrl = formData.get('repositoryUrl') as string
    const isPublic = formData.get('isPublic') === 'on'

    if (name && teamId) {
      saveProject({
        name,
        teamId,
        slug: slug || undefined,
        repositoryUrl,
        isPublic,
      })
    }
  }

  return (
    <DialogModal id={isEdit ? 'edit-project' : 'add-project'}>
      <DialogTitle>{isEdit ? 'Edit Project' : 'Add Project'}</DialogTitle>
      <form onSubmit={handleSubmit} class='space-y-4'>
        <FormField label='Name'>
          <input
            type='text'
            name='name'
            defaultValue={project?.name || ''}
            required
            class='input input-bordered w-full'
          />
        </FormField>
        <FormField label='Team'>
          <select
            name='teamId'
            defaultValue={project?.teamId || ''}
            required
            class='select select-bordered w-full'
          >
            <option disabled value=''>Select a team</option>
            {teams.data?.map((t) => (
              <option key={t.teamId} value={t.teamId}>{t.teamName}</option>
            ))}
          </select>
        </FormField>
        <FormField label='Repository URL'>
          <input
            type='url'
            name='repositoryUrl'
            defaultValue={project?.repositoryUrl || ''}
            class='input input-bordered w-full'
          />
        </FormField>
        <div class='form-control'>
          <label class='label cursor-pointer'>
            <span class='label-text'>Public</span>
            <input
              type='checkbox'
              name='isPublic'
              defaultChecked={project?.isPublic}
              class='toggle'
            />
          </label>
        </div>
        <div class='modal-action'>
          <A class='btn btn-ghost' params={{ dialog: null, slug: null }}>
            Cancel
          </A>
          <button type='submit' class='btn btn-primary'>Save</button>
        </div>
      </form>
    </DialogModal>
  )
}

function TeamSettingsSection({ team }: { team: Team }) {
  return (
    <div class='space-y-6 max-w-md'>
      <form
        onSubmit={(e) => saveTeam(e, team.teamId)}
        class='space-y-4'
      >
        <FormField label='Team Name'>
          <input
            type='text'
            name='name'
            defaultValue={team.teamName}
            class='input input-bordered w-full'
          />
        </FormField>
        <button
          type='submit'
          class='btn btn-primary btn-sm mt-2'
        >
          Save
        </button>
      </form>
      <div class='divider' />
      <div>
        <h4 class='font-medium mb-2 text-error'>Danger Zone</h4>
        <A
          params={{ dialog: 'delete', id: team.teamId, key: 'team' }}
          class='btn btn-error btn-sm'
        >
          Delete Team
        </A>
      </div>
    </div>
  )
}

function TeamMembersSection({ team }: { team: Team }) {
  return (
    <div class='overflow-x-auto pb-10'>
      <table class='table-auto w-full text-sm'>
        <thead>
          <tr class='border-b border-divider'>
            <th class='text-left py-2 text-text2 font-medium'>User</th>
            <th class='text-left py-2 text-text2 font-medium'>Role</th>
            <th class='text-right py-2 text-text2 font-medium'>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.data?.map((u) => (
            <TeamMembersRow key={u.userEmail} user={u} team={team} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamProjectsSection({ team }: { team: Team }) {
  const teamProjects = projects.data?.filter((p) => p.teamId === team.teamId) ||
    []
  return (
    <div>
      <A
        class='btn btn-primary btn-sm mb-4'
        params={{ dialog: 'add-project', teamId: team.teamId }}
      >
        + Add Project
      </A>
      {teamProjects.length === 0
        ? <p class='text-text2'>No projects in this team.</p>
        : (
          <div class='overflow-x-auto pb-10'>
            <table class='table-auto w-full text-sm'>
              <thead>
                <tr class='border-b border-divider'>
                  <th class='text-left py-2 text-text2 font-medium'>Project</th>
                  <th class='text-left py-2 text-text2 font-medium'>Slug</th>
                  <th class='text-left py-2 text-text2 font-medium'>Created</th>
                  <th class='text-right py-2 text-text2 font-medium'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {teamProjects.map((p) => (
                  <TeamProjectsRow key={p.slug} project={p} />
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

const TabNav = ({ tab, sections }: { tab: string; sections: string[] }) => (
  <div class='flex border-b border-divider mb-4'>
    {sections.map((t) => (
      <A
        key={t}
        params={{ tab: t }}
        class={`px-4 py-2 text-sm font-medium capitalize transition ${
          tab === t
            ? 'text-primary border-b-2 border-primary'
            : 'text-text2 hover:text-text'
        }`}
      >
        {t}
      </A>
    ))}
  </div>
)

function TeamsManagementDialog() {
  const { dialog, steamid, tab } = url.params
  if (dialog !== 'manage-teams') return null
  if (tab !== 'members' && tab !== 'projects' && tab !== 'settings') {
    navigate({ params: { tab: 'members' }, replace: true })
    return null
  }

  const selectedTeamId = steamid || (teams.data || [])[0]?.teamId
  const selectedTeam = teams.data?.find((t) => t.teamId === selectedTeamId)

  return (
    <Dialog id='manage-teams' class='modal'>
      <div class='modal-box w-full max-w-5xl h-[90vh] flex flex-col'>
        <DialogTitle>Team Management</DialogTitle>
        <div class='flex-1 flex gap-4 overflow-hidden'>
          <aside class='w-72 shrink-0 border-r border-divider flex flex-col'>
            <div class='p-4 flex-1 flex flex-col'>
              <DialogSectionTitle>My Teams</DialogSectionTitle>
              <ul class='space-y-1 flex-1 overflow-y-auto'>
                {teams.data?.map((t) => (
                  <li key={t.teamId}>
                    <A
                      params={{ steamid: t.teamId, tab: 'members' }}
                      class={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                        t.teamId === selectedTeamId
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-surface2'
                      }`}
                    >
                      {t.teamName}
                    </A>
                  </li>
                ))}
              </ul>
              <form onSubmit={(e) => saveTeam(e)} class='mt-4 space-y-2'>
                <FormField label='New team ID'>
                  <input
                    type='text'
                    name='teamId'
                    required
                    class='input input-bordered input-sm w-full'
                  />
                </FormField>
                <FormField label='New team name'>
                  <input
                    type='text'
                    name='name'
                    required
                    class='input input-bordered input-sm w-full'
                  />
                </FormField>
                <button
                  type='submit'
                  class='btn btn-sm btn-primary w-full mt-2'
                >
                  + Add Team
                </button>
              </form>
            </div>
          </aside>
          <main class='flex-1 p-4 overflow-y-auto'>
            {selectedTeam
              ? (
                <>
                  <h3 class='text-lg font-semibold mb-4'>
                    {selectedTeam.teamName}
                  </h3>
                  <TabNav
                    tab={tab}
                    sections={['members', 'projects', 'settings']}
                  />
                  {tab === 'members' && (
                    <TeamMembersSection team={selectedTeam} />
                  )}
                  {tab === 'projects' && (
                    <TeamProjectsSection team={selectedTeam} />
                  )}
                  {tab === 'settings' && (
                    <TeamSettingsSection team={selectedTeam} />
                  )}
                </>
              )
              : <p class='text-text2'>Select a team to manage.</p>}
          </main>
        </div>
      </div>
    </Dialog>
  )
}

function DeleteDialog() {
  const { dialog, id, key } = url.params
  if (dialog !== 'delete' || !id || (key !== 'project' && key !== 'team')) {
    return null
  }

  const name = key === 'project'
    ? projects.data?.find((p) => p.slug === id)?.name
    : teams.data?.find((t) => t.teamId === id)?.teamName

  if (!name) return null
  const canDelete = useSignal(false)

  const handleDelete = (e: Event) => {
    e.preventDefault()
    if (key === 'project') {
      deleteProject(id)
    } else if (key === 'team') {
      deleteTeam(id)
    }
  }

  return (
    <DialogModal id='delete'>
      <DialogTitle>Confirm deletion</DialogTitle>
      <p class='text-sm text-text2 mb-4'>
        Are you sure you want to delete{' '}
        <span class='font-medium'>"{name}"</span>? This action cannot be undone.
      </p>
      <form onSubmit={handleDelete}>
        <FormField label={`Type ${id} to confirm`}>
          <input
            type='text'
            class='input input-bordered input-sm w-full'
            onInput={(
              e,
            ) => (canDelete.value =
              (e.target as HTMLInputElement).value.trim() === id)}
            placeholder={id || undefined}
          />
        </FormField>
        <div class='modal-action'>
          <A
            class='btn btn-ghost'
            params={{ dialog: null, slug: null, id: null, key: null }}
          >
            Cancel
          </A>
          <button
            type='submit'
            class='btn btn-error'
            disabled={!canDelete.value}
          >
            Delete
          </button>
        </div>
      </form>
    </DialogModal>
  )
}

export function ProjectsPage() {
  const q = url.params.q?.toLowerCase() ?? ''

  const onSearchInput = (e: Event) =>
    navigate({
      params: { q: (e.target as HTMLInputElement).value || null },
      replace: true,
    })

  const filteredProjects = q
    ? projects.data?.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q)
    )
    : projects.data

  const projectsByTeam = filteredProjects?.reduce((acc, p) => {
    ;(acc[p.teamId] ||= []).push(p as Project)
    return acc
  }, {} as Record<string, Project[]>) || {}

  const isAdmin = user.data?.isAdmin ?? false

  const disable = isAdmin
    ? ''
    : 'pointer-events-none cursor-not-allowed opacity-20'

  const hasTeams = teams.data && teams.data.length > 0
  return (
    <PageLayout>
      <PageHeader>
        <h1 class='text-xl sm:text-2xl font-semibold text-text'>Projects</h1>
        <div class='flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto'>
          <div class='relative w-full sm:w-auto sm:max-w-sm'>
            <Search class='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text2 pointer-events-none' />
            <input
              type='text'
              placeholder='Search projects...'
              value={url.params.q ?? ''}
              onInput={onSearchInput}
              class='w-full bg-surface2 border border-divider rounded-lg py-2 pl-10 pr-4 text-sm placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all'
            />
          </div>
          <div class='flex gap-2'>
            <A
              params={{ dialog: 'add-project' }}
              class={`btn btn-primary btn-sm flex items-center gap-1.5 ${disable}`}
            >
              <Plus class='w-4 h-4' />{' '}
              <span class='hidden sm:inline'>Add Project</span>
            </A>
            <A
              params={{ dialog: 'manage-teams' }}
              class={`btn btn-ghost btn-sm flex items-center gap-1.5 ${disable}`}
            >
              <Settings class='w-4 h-4' />{' '}
              <span class='hidden sm:inline'>Teams</span>
            </A>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        {!hasTeams
          ? (
            <EmptyState
              icon={Search}
              title={teams.pending ? 'Loading teams...' : 'No teams found'}
              subtitle={teams.pending
                ? 'Please wait while we load the teams.'
                : 'Contact an administrator'}
            />
          )
          : teams.data?.map((team) => {
            const teamProjects = projectsByTeam[team.teamId] ?? []
            return (
              <section key={team.teamId} class='mb-12 last:mb-0'>
                <SectionTitle
                  title={team.teamName}
                  count={teamProjects.length}
                />
                {teamProjects.length > 0
                  ? (
                    <div class='grid gap-4 sm:gap-6 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]'>
                      {teamProjects.map((p) => (
                        <ProjectCard
                          key={p.slug}
                          project={p}
                          team={team}
                        />
                      ))}
                    </div>
                  )
                  : (
                    <div class='text-center py-8 bg-surface rounded-lg border border-divider'>
                      <Folder class='w-8 h-8 text-text2 mx-auto mb-2' />
                      <p class='text-text2 text-sm'>
                        {q
                          ? 'No projects found for this team'
                          : 'No projects yet'}
                      </p>
                    </div>
                  )}
              </section>
            )
          }) || []}
      </PageContent>
      <ProjectDialog />
      <TeamsManagementDialog />
      <DeleteDialog />
      <Toast />
    </PageLayout>
  )
}
