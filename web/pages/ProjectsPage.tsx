import { signal, useSignal } from '@preact/signals'
import { A, navigate } from '../lib/router.tsx'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Folder,
  LucideIcon,
  Plus,
  Search,
  Settings,
} from 'lucide-preact'
import { Dialog, DialogModal } from '../components/Dialog.tsx'
import { url } from '../lib/router.tsx'
import { JSX } from 'preact'
import { user } from '../lib/session.ts'

type User = {
  id: number
  name: string
  email: string
  isAdmin: boolean
  teamIds: number[]
}
type Team = { id: number; name: string }
type Project = {
  slug: string
  name: string
  teamId: number
  createdAt: string
}

const users = signal<User[]>([
  {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    isAdmin: true,
    teamIds: [1333, 1334],
  },
  {
    id: 2,
    name: 'Bob',
    email: 'bob@example.com',
    isAdmin: false,
    teamIds: [1333],
  },
  {
    id: 3,
    name: 'Cara',
    email: 'cara@example.com',
    isAdmin: false,
    teamIds: [1334],
  },
])
const teams = signal<Team[]>([
  { id: 1333, name: 'Platform' },
  { id: 1334, name: 'Tournament' },
  { id: 1335, name: 'Gamma' },
])
const projects = signal<Project[]>([
  {
    slug: 'tomorrow-school',
    name: 'Tomorrow School',
    teamId: 1333,
    createdAt: '2023-10-15T00:00:00.000Z',
  },
  {
    slug: 'tournament-beta',
    name: 'Tournament Beta',
    teamId: 1334,
    createdAt: '2023-11-05T00:00:00.000Z',
  },
])
const toastSignal = signal<{ message: string; type: 'info' | 'error' } | null>(
  null,
)

const slugify = (str: string) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')

function saveProject(data: { name: string; teamId: number; slug?: string }) {
  const { slug, name, teamId } = data
  const projectsValues = projects.peek()
  if (!slug) {
    const base = slugify(name)
    let suffix = ''
    let finalSlug = base
    do {
      finalSlug = base + suffix
      suffix = suffix ? String(Number(suffix) + 1) : '0'
    } while (projectsValues.some((p) => p.slug === finalSlug))
    const now = new Date().toISOString()
    const project: Project = { slug: finalSlug, name, teamId, createdAt: now }
    projects.value = [...projectsValues, project]
  } else {
    const idx = projectsValues.findIndex((p) => p.slug === slug)
    const copy = [...projectsValues]
    copy[idx] = { ...projectsValues[idx], name, teamId }
    projects.value = copy
  }

  navigate({ params: { dialog: null }, replace: true })
}

function saveTeam(data: { id?: number; name: string }) {
  const { id, name } = data
  if (id) {
    const idx = teams.value.findIndex((t) => t.id === id)
    if (idx !== -1) teams.value[idx] = { ...teams.value[idx], name }
  } else {
    const newId = Math.max(...teams.value.map((t) => t.id), 0) + 1
    teams.value = [...teams.value, { id: newId, name }]
  }
}

function toast(message: string, type: 'info' | 'error' = 'info') {
  toastSignal.value = { message, type }
  setTimeout(() => (toastSignal.value = null), 3000)
}

function deleteTeam(id: number) {
  if (projects.value.some((p) => p.teamId === id)) {
    toast('Cannot delete a team that still has projects.', 'error')
    return
  }
  teams.value = teams.value.filter((t) => t.id !== id)
  toast('Team deleted.')
}

function addUserToTeam(userId: number, teamId: number) {
  const user = users.value.find((u) => u.id === userId)
  if (!user) return
  if (!user.teamIds.includes(teamId)) {
    user.teamIds = [...user.teamIds, teamId]
    users.value = [...users.value]
  }
}

function removeUserFromTeam(userId: number, teamId: number) {
  const user = users.value.find((u) => u.id === userId)
  if (!user) return
  user.teamIds = user.teamIds.filter((id) => id !== teamId)
  users.value = [...users.value]
}

const PageLayout = (
  { children }: { children: JSX.Element | JSX.Element[] },
) => (
  <div class='h-screen flex justify-center bg-bg'>
    <div class='w-full max-w-7xl h-full bg-base-100 flex flex-col'>
      {children}
    </div>
  </div>
)
const PageHeader = (
  { children }: { children: JSX.Element | JSX.Element[] },
) => (
  <header class='px-4 sm:px-6 py-4 bg-surface border-b border-divider'>
    <div class='flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4'>
      {children}
    </div>
  </header>
)
const PageContent = (
  { children }: { children: JSX.Element | JSX.Element[] },
) => (
  <main class='flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-20'>{children}</main>
)
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

const ProjectCard = ({ project }: { project: Project }) => (
  <A
    key={project.slug}
    href={`/projects/${project.slug}`}
    class='block hover:no-underline w-full h-18'
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
                {new Date(project.createdAt).toLocaleDateString('fr-CA')}
              </span>
            </div>
          </div>
        </div>
        <ArrowRight class='w-5 h-5 text-primary flex-shrink-0 group-hover:translate-x-1 transition-transform duration-200' />
      </div>
    </article>
  </A>
)

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
      <div class='font-medium truncate'>{user.name}</div>
      <div class='text-text2 truncate'>{user.email}</div>
    </td>
    <td class='py-3'>{user.isAdmin ? 'Admin' : 'Member'}</td>
    <td class='py-3 text-right'>
      <input
        type='checkbox'
        class='toggle toggle-sm toggle-primary'
        checked={user.teamIds.includes(team.id)}
        onChange={(e) => {
          if ((e.target as HTMLInputElement).checked) {
            addUserToTeam(user.id, team.id)
          } else removeUserFromTeam(user.id, team.id)
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
      {new Date(project.createdAt).toLocaleDateString('fr-CA')}
    </td>
    <td class='py-3 text-right flex gap-2 justify-end'>
      <A
        params={{ dialog: 'edit-project', slug: project.slug }}
        class='btn btn-ghost btn-xs'
      >
        Edit
      </A>
      <A
        params={{ dialog: 'delete-project', slug: project.slug }}
        class='btn btn-ghost btn-xs text-danger'
      >
        Delete
      </A>
    </td>
  </tr>
)

function ProjectDialog() {
  const isEdit = url.params.dialog === 'edit-project'
  const slug = url.params.slug
  const project = isEdit
    ? projects.value.find((p) => p.slug === slug)
    : undefined

  const name = useSignal(project?.name ?? '')
  const teamId = useSignal<number | null>(null)

  const onSubmit = (e: Event) => {
    e.preventDefault()
    if (!teamId.value) return
    saveProject({
      name: name.value,
      teamId: teamId.value,
      slug: isEdit ? project?.slug : undefined,
    })
  }

  return (
    <DialogModal id={isEdit ? 'edit-project' : 'add-project'}>
      <h3 class='text-lg font-semibold mb-4'>
        {isEdit ? 'Edit Project' : 'Add Project'}
      </h3>
      <form onSubmit={onSubmit} class='space-y-4'>
        <FormField label='Name'>
          <input
            type='text'
            value={name.value}
            onInput={(e) => (name.value = (e.target as HTMLInputElement).value)}
            required
            class='input input-bordered w-full'
          />
        </FormField>
        <FormField label='Team'>
          <select
            value={teamId.value ?? ''}
            onChange={(e) => (teamId.value = Number(e.currentTarget.value))}
            required
            class='select select-bordered w-full'
          >
            <option disabled value=''>Select a team</option>
            {teams.value.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </FormField>
        <div class='modal-action'>
          <A class='btn btn-ghost' params={{ dialog: null }}>Cancel</A>
          <button type='submit' class='btn btn-primary'>Save</button>
        </div>
      </form>
    </DialogModal>
  )
}

function TeamSettingsSection({ team }: { team: Team }) {
  const name = useSignal(team.name)
  return (
    <div class='space-y-6 max-w-md'>
      <div>
        <FormField label='Team Name'>
          <input
            type='text'
            value={name.value}
            onInput={(e) => (name.value = e.currentTarget.value)}
            class='input input-bordered w-full'
          />
        </FormField>
        <button
          type='button'
          class='btn btn-primary btn-sm mt-2'
          onClick={() => saveTeam({ id: team.id, name: name.value })}
        >
          Save
        </button>
      </div>
      <div class='divider' />
      <div>
        <h4 class='font-medium mb-2 text-error'>Danger Zone</h4>
        <button
          type='button'
          class='btn btn-error btn-sm'
          onClick={() => deleteTeam(team.id)}
        >
          Delete Team
        </button>
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
          {users.value.map((u) => (
            <TeamMembersRow key={u.id} user={u} team={team} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamProjectsSection({ team }: { team: Team }) {
  const teamProjects = projects.value.filter((p) => p.teamId === team.id)
  return (
    <div>
      <A
        class='btn btn-primary btn-sm mb-4'
        params={{ dialog: 'add-project', teamId: team.id }}
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

function TeamsManagementDialog() {
  const selectedTeamId = useSignal<number>(teams.value[0]?.id ?? 0)
  const newTeamName = useSignal('')
  const tab = useSignal<'members' | 'projects' | 'settings'>('members')

  if (url.params.dialog !== 'manage-teams') return null
  const selectedTeam = teams.value.find((t) => t.id === selectedTeamId.value)

  return (
    <Dialog id='manage-teams' class='modal'>
      <div class='modal-box w-full max-w-5xl h-[90vh] flex flex-col'>
        <form method='dialog'>
          <button
            type='submit'
            class='btn btn-sm btn-circle btn-ghost absolute right-2 top-2'
          >
            ✕
          </button>
        </form>
        <h2 class='text-lg font-semibold mb-4'>Team Management</h2>
        <div class='flex-1 flex gap-4 overflow-hidden'>
          <aside class='w-72 shrink-0 border-r border-divider flex flex-col'>
            <div class='p-4 flex-1 flex flex-col'>
              <h3 class='text-sm font-medium text-text2 mb-3'>Teams</h3>
              <ul class='space-y-1 flex-1 overflow-y-auto'>
                {teams.value.map((t) => (
                  <li key={t.id}>
                    <button
                      type='button'
                      onClick={() => (selectedTeamId.value = t.id)}
                      class={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                        t.id === selectedTeamId.value
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-surface2'
                      }`}
                    >
                      {t.name}
                    </button>
                  </li>
                ))}
              </ul>
              <div class='mt-4'>
                <FormField label='New team name'>
                  <input
                    type='text'
                    value={newTeamName.value}
                    onInput={(e) => (newTeamName.value = e.currentTarget.value)}
                    class='input input-bordered input-sm w-full'
                  />
                </FormField>
                <button
                  type='button'
                  class='btn btn-sm btn-primary w-full mt-2'
                  onClick={() => {
                    if (!newTeamName.value.trim()) return
                    saveTeam({ name: newTeamName.value })
                    newTeamName.value = ''
                  }}
                >
                  + Add Team
                </button>
              </div>
            </div>
          </aside>
          <main class='flex-1 p-4 overflow-y-auto'>
            {selectedTeam
              ? (
                <>
                  <h3 class='text-lg font-semibold mb-4'>
                    {selectedTeam.name}
                  </h3>
                  <div class='flex border-b border-divider mb-4'>
                    {(['members', 'projects', 'settings'] as const).map((t) => (
                      <button
                        key={t}
                        type='button'
                        onClick={() => (tab.value = t)}
                        class={`px-4 py-2 text-sm font-medium capitalize transition ${
                          tab.value === t
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-text2 hover:text-text'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {tab.value === 'members' && (
                    <TeamMembersSection team={selectedTeam} />
                  )}
                  {tab.value === 'projects' && (
                    <TeamProjectsSection team={selectedTeam} />
                  )}
                  {tab.value === 'settings' && (
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
  const slug = url.params.slug
  const project = projects.value.find((p) => p.slug === slug)
  const confirmSlug = useSignal('')

  if (url.params.dialog !== 'delete-project') return null
  const canDelete = confirmSlug.value === slug

  const onDelete = () => {
    if (!canDelete) return
    projects.value = projects.value.filter((p) => p.slug !== slug)
    navigate({ params: { dialog: null } })
    toast('Project deleted.')
    confirmSlug.value = ''
  }

  return (
    <DialogModal id='delete-project'>
      <h3 class='text-lg font-semibold mb-2'>Confirm deletion</h3>
      <p class='text-sm text-text2 mb-4'>
        Are you sure you want to delete{' '}
        <span class='font-medium'>"{project?.name}"</span>? This action cannot
        be undone.
      </p>
      <FormField label={`Type ${slug} to confirm`}>
        <input
          type='text'
          value={confirmSlug.value}
          onInput={(
            e,
          ) => (confirmSlug.value = (e.target as HTMLInputElement).value)}
          class='input input-bordered input-sm w-full'
          placeholder={slug || undefined}
        />
      </FormField>
      <div class='modal-action'>
        <A class='btn btn-ghost' params={{ dialog: null }}>Cancel</A>
        <button
          type='button'
          class='btn btn-error'
          disabled={!canDelete}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
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
    ? projects.value.filter((p) =>
      p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    )
    : projects.value

  const projectsByTeam = filteredProjects.reduce((acc, p) => {
    ;(acc[p.teamId] ||= []).push(p)
    return acc
  }, {} as Record<number, Project[]>)

  const isAdmin = user.data?.isAdmin ?? false

  const disable = isAdmin
    ? ''
    : 'pointer-events-none cursor-not-allowed opacity-20'

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
        {teams.value.length === 0
          ? (
            <EmptyState
              icon={Search}
              title='No teams available'
              subtitle='Contact an administrator'
            />
          )
          : teams.value.map((team) => {
            const teamProjects = projectsByTeam[team.id] ?? []
            return (
              <section key={team.id} class='mb-12 last:mb-0'>
                <SectionTitle title={team.name} count={teamProjects.length} />
                {teamProjects.length > 0
                  ? (
                    <div class='grid gap-4 sm:gap-6 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]'>
                      {teamProjects.map((p) => (
                        <ProjectCard key={p.slug} project={p} />
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
          })}
      </PageContent>
      <ProjectDialog />
      <TeamsManagementDialog />
      <DeleteDialog />
      <Toast />
    </PageLayout>
  )
}
