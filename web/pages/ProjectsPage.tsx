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
import { api } from '../lib/api.ts'
import { Project as ApiProject, Team, User } from '../../api/schema.ts'

type Project = ApiProject & {
  createdAt: string
}

const users = api['GET/api/users'].signal()
users.fetch()
console.log('Users:', users.data);

const teams = api['GET/api/teams'].signal()
teams.fetch()
console.log('Teams:', teams.data);

const projects = api['GET/api/projects'].signal()
projects.fetch()
console.log('Projects:', projects.data);

const toastSignal = signal<{ message: string; type: 'info' | 'error' } | null>(
  null,
)

const slugify = (str: string) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')

function _saveProject(data: { name: string; teamId: string; slug?: string }) {
  const { slug, name, teamId } = data
  const projectsValues = projects.data || []
  if (!slug) {
    const base = slugify(name)
    let suffix = ''
    let finalSlug = base
    do {
      finalSlug = base + suffix
      suffix = suffix ? String(Number(suffix) + 1) : '0'
    } while (projectsValues.some((p) => p.projectSlug === finalSlug))
    const now = new Date().toISOString()
    const project: Project = {
      projectSlug: finalSlug,
      projectName: name,
      teamId,
      createdAt: now,
      repositoryUrl: '',
      isPublic: false,
    }
    projects.data = [...projectsValues, project]
  } else {
    const idx = projectsValues.findIndex((p) => p.projectSlug === slug)
    const copy = [...projectsValues]
    copy[idx] = { ...projectsValues[idx], projectName: name, teamId }
    projects.data = copy
  }

  navigate({ params: { dialog: null }, replace: true })
}

function saveTeam(_e: Event) {
}

function toast(message: string, type: 'info' | 'error' = 'info') {
  toastSignal.value = { message, type }
  setTimeout(() => (toastSignal.value = null), 3000)
}

function _deleteTeam(_id: number) {
}

function addUserToTeam(user: User, team: Team) {
  if (team.teamMembers.includes(user.userEmail)) return
  team.teamMembers.push(user.userEmail)
  teams.data = [...teams.data || []]
  toast(`${user.userFullName} added to ${team.teamName}.`)
}

function removeUserFromTeam(user: User, team: Team) {
  const idx = team.teamMembers.indexOf(user.userEmail)
  if (idx === -1) return
  team.teamMembers.splice(idx, 1)
  teams.data = [...teams.data || []]
  toast(`${user.userFullName} removed from ${team.teamName}.`)
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
    key={project.projectSlug}
    href={`/projects/${project.projectSlug}`}
    class='block hover:no-underline w-full h-18'
  >
    <article class='card bg-base-200 border border-base-300 hover:bg-base-300 transition-colors h-full'>
      <div class='card-body p-4 h-full flex-row items-center gap-4'>
        <div class='flex-1 min-w-0 flex flex-col justify-center'>
          <h3
            class='font-semibold text-base-content text-base leading-tight truncate'
            title={project.projectName}
          >
            {project.projectName.length > 25
              ? project.projectName.slice(0, 22) + '…'
              : project.projectName}
          </h3>
          <div class='flex items-center gap-3 mt-1 text-xs text-base-content/70'>
            <span class='font-mono truncate'>{project.projectSlug}</span>
            <div class='flex items-center gap-1 flex-shrink-0'>
              <Calendar class='w-3.5 h-3.5' />
              <span>
                {new Date(project['createdAt'] as string).toLocaleDateString()}
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
    <td class='py-3 font-medium truncate'>{project.projectName}</td>
    <td class='py-3 text-text2 truncate'>{project.projectSlug}</td>
    <td class='py-3 text-text2 whitespace-nowrap'>
      {new Date(project.createdAt).toLocaleDateString()}
    </td>
    <td class='py-3 text-right flex gap-2 justify-end'>
      <A
        params={{ dialog: 'edit-project', slug: project.projectSlug }}
        class='btn btn-ghost btn-xs'
      >
        Edit
      </A>
      <A
        params={{ dialog: 'delete', id: project.projectSlug, key: 'project' }}
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

const onSubmit = (e: Event) => {
  e.preventDefault()
}

function ProjectDialog() {
  const { dialog, slug } = url.params
  const isEdit = dialog === 'edit-project'
  const project = isEdit
    ? projects.data?.find((p) => p.projectSlug === slug)
    : undefined

  return (
    <DialogModal id={isEdit ? 'edit-project' : 'add-project'}>
      <DialogTitle>{isEdit ? 'Edit Project' : 'Add Project'}</DialogTitle>
      <form onSubmit={onSubmit} class='space-y-4'>
        <FormField label='Name'>
          <input
            type='text'
            defaultValue={project?.projectName || ''}
            required
            class='input input-bordered w-full'
          />
        </FormField>
        <FormField label='Team'>
          <select
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
        <div class='modal-action'>
          <A class='btn btn-ghost' params={{ dialog: null }}>Cancel</A>
          <button type='submit' class='btn btn-primary'>Save</button>
        </div>
      </form>
    </DialogModal>
  )
}

function TeamSettingsSection({ team }: { team: Team }) {
  return (
    <div class='space-y-6 max-w-md'>
      <form onSubmit={saveTeam} class='space-y-4'>
        <FormField label='Team Name'>
          <input
            type='text'
            defaultValue={team.teamName}
            class='input input-bordered w-full'
          />
        </FormField>
        <button
          type='button'
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
                  <TeamProjectsRow key={p.projectSlug} project={p as Project} />
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
  if (dialog !== 'manage-teams' || !steamid) return null
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
              <form onSubmit={saveTeam} class='mt-4'>
                <FormField label='New team name'>
                  <input
                    type='text'
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

const onDelete = (e: Event) => {
  e.preventDefault()
}
function DeleteDialog() {
  const { dialog, id, key } = url.params
  if (dialog !== 'delete' || (key !== 'project' && key !== 'team')) return null

  const name = key === 'project'
    ? projects.data?.find((p) => p.projectSlug === id)?.projectName
    : teams.data?.find((t) => t.teamId === id)?.teamName

  if (!name) return null
  const canDelete = useSignal(false)

  return (
    <DialogModal id='delete'>
      <DialogTitle>Confirm deletion</DialogTitle>
      <p class='text-sm text-text2 mb-4'>
        Are you sure you want to delete{' '}
        <span class='font-medium'>"{name}"</span>? This action cannot be undone.
      </p>
      <form onSubmit={onDelete}>
        <FormField label={`Type ${id} to confirm`}>
          <input
            type='text'
            class='input input-bordered input-sm w-full'
            onChange={(
              e,
            ) => (canDelete.value =
              (e.target as HTMLInputElement).value.trim() === id)}
            placeholder={id || undefined}
          />
        </FormField>
        <div class='modal-action'>
          <A class='btn btn-ghost' params={{ dialog: null, slug: null }}>
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
  console.log(teams.data, projects.data, users.data);
  
  const onSearchInput = (e: Event) =>
    navigate({
      params: { q: (e.target as HTMLInputElement).value || null },
      replace: true,
    })

  const filteredProjects = q
    ? projects.data?.filter((p) =>
      p.projectName.toLowerCase().includes(q) ||
      p.projectSlug.toLowerCase().includes(q)
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
        {hasTeams
          ? (
            <EmptyState
              icon={Search}
              title={teams.pending ? 'Loading teams...' : 'No teams found'}
              subtitle={teams.pending ? 'Please wait while we load the teams.' : 'Contact an administrator'}
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
                        <ProjectCard key={p.projectSlug} project={p} />
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
