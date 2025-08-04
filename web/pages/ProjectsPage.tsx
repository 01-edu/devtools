/* src/pages/ProjectsPage.tsx */
import { signal, useSignal } from '@preact/signals'
import { A, navigate } from '../lib/router.tsx'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Folder,
  Plus,
  Search,
  Settings,
} from 'lucide-preact'
import { Dialog, DialogModal } from '../components/Dialog.tsx'
import { url } from '../lib/router.tsx'
import { user } from '../lib/session.ts'

/* ---------- Types ---------- */
type User = {
  id: number
  name: string
  email: string
  isAdmin: boolean
  teamIds: number[]
}

type Team = {
  id: number
  name: string
}

type Project = {
  slug: string
  name: string
  teamId: number
  createdAt: string
}

/* ---------- Mock data / signals ---------- */
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

/* ---------- Helpers ---------- */
function openDialog(name: string, extra?: Record<string, string>) {
  navigate({ params: { dialog: name, ...extra }, replace: true })
}
function closeDialog() {
  navigate({ params: { dialog: null }, replace: true })
}

const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')

function saveProject(
  data: { name: string; teamId: number; slug?: string },
) {
  const { slug, name, teamId } = data

  let finalSlug = slug
  if (!finalSlug) {
    const base = slugify(name)
    let suffix = ''
    do {
      finalSlug = base + suffix
      suffix = suffix ? String(Number(suffix) + 1) : '-1'
    } while (projects.value.some((p) => p.slug === finalSlug))
  }

  const idx = projects.value.findIndex((p) => p.slug === finalSlug)
  const now = new Date().toISOString()
  const project: Project = { slug: finalSlug, name, teamId, createdAt: now }

  if (idx === -1) projects.value = [...projects.value, project]
  else projects.value[idx] = { ...projects.value[idx], ...project }

  closeDialog()
}

function deleteProject(slug: string) {
  openDialog('delete-project', { slug })
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

function deleteTeam(id: number) {
  if (projects.value.some((p) => p.teamId === id)) {
    toast('Cannot delete a team that still has projects.')
    return
  }
  teams.value = teams.value.filter((t) => t.id !== id)
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

/* ---------- Toast ---------- */
const toastSignal = signal<{ message: string; type: 'info' | 'error' } | null>(
  null,
)
function toast(message: string, type: 'info' | 'error' = 'info') {
  toastSignal.value = { message, type }
  setTimeout(() => (toastSignal.value = null), 3000)
}

/* ---------- Main page ---------- */
export function ProjectsPage() {
  const q = url.params.q ?? ''

  const onSearchInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value
    navigate({ params: { q: v || null }, replace: true })
  }

  const filteredProjects = projects.value.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q.toLowerCase()),
  )
  const projectsByTeam = filteredProjects.reduce((acc, p) => {
    ;(acc[p.teamId] ||= []).push(p)
    return acc
  }, {} as Record<number, Project[]>)

  return (
    <div class='h-screen flex justify-center bg-bg'>
      <div class='w-full max-w-7xl h-full bg-base-100 flex flex-col'>
        {/* Header */}
        <header class='px-4 sm:px-6 py-4 bg-surface border-b border-divider'>
          <div class='flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4'>
            <h1 class='text-xl sm:text-2xl font-semibold text-text'>
              Projects
            </h1>

            <div class='flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto'>
              <div class='relative w-full sm:w-auto sm:max-w-sm'>
                <Search class='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text2 pointer-events-none' />
                <input
                  type='text'
                  placeholder='Search projects...'
                  value={q}
                  onInput={onSearchInput}
                  class='w-full bg-surface2 border border-divider rounded-lg py-2 pl-10 pr-4 text-sm 
                         placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-primary/50 
                         focus:border-primary transition-all'
                />
              </div>

              <div class='flex gap-2'>
                <button
                  type='button'
                  onClick={() => openDialog('add-project')}
                  class='btn btn-primary btn-sm flex items-center gap-1.5'
                  disabled={teams.value.length > 0 && !user.data?.isAdmin}
                >
                  <Plus class='w-4 h-4' />
                  <span class='hidden sm:inline'>Add Project</span>
                </button>

                <button
                  type='button'
                  onClick={() => openDialog('manage-teams')}
                  class='btn btn-ghost btn-sm flex items-center gap-1.5'
                  disabled={!user.data?.isAdmin}
                >
                  <Settings class='w-4 h-4' />
                  <span class='hidden sm:inline'>Teams</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main class='flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-20'>
          {teams.value.length === 0 && (
            <div class='flex flex-col items-center justify-center py-20'>
              <Search class='w-12 h-12 text-text2 mb-4' />
              <p class='text-text2 text-center'>No teams available</p>
              <p class='text-text3 text-sm mt-1'>Contact an administrator</p>
            </div>
          )}

          {teams.value.map((team) => (
            <section key={team.id} class='mb-12 last:mb-0'>
              <div class='flex items-center gap-3 mb-4 sm:mb-6'>
                <h2 class='text-lg sm:text-xl font-medium text-text'>
                  {team.name}
                </h2>
                <span class='text-sm text-text2 bg-surface2 px-2.5 py-1 rounded-full'>
                  {projectsByTeam[team.id]?.length ?? 0}
                </span>
              </div>

              {projectsByTeam[team.id]?.length
                ? (
                  <div class='grid gap-4 sm:gap-6 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]'>
                    {(projectsByTeam[team.id] ?? []).map((p) => (
                      <ProjectCard key={p.slug} project={p} />
                    ))}
                  </div>
                )
                : (
                  <div class='text-center py-8 bg-surface rounded-lg border border-divider'>
                    <Folder class='w-8 h-8 text-text2 mx-auto mb-2' />
                    <p class='text-text2 text-sm'>
                      {q ? 'No projects found' : 'No projects yet'}
                    </p>
                  </div>
                )}
            </section>
          ))}
        </main>

        {/* Dialogs */}
        <ProjectDialog />
        <TeamsManagementDialog />
        <DeleteDialog />

        {/* Toast */}
        {toastSignal.value && (
          <div class='fixed bottom-4 right-4 bg-surface shadow-lg rounded-lg p-4 text-sm flex items-center gap-3 z-50'>
            {toastSignal.value.type === 'error' && (
              <AlertTriangle class='w-5 h-5 text-danger' />
            )}
            <span class='text-text'>{toastSignal.value.message}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- ProjectCard ---------- */

const ProjectCard = ({ project }: { project: Project }) => {
  const authorized = true

  return (
    <A
      href={authorized ? `/projects/${project.slug}` : undefined}
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
}
/* ---------- Project Dialog ---------- */
function ProjectDialog() {
  const id = url.params.dialog
  const slug = url.params.slug
  const isEdit = id === 'edit-project'
  const project = isEdit
    ? projects.value.find((p) => p.slug === slug)
    : undefined

  // valeurs initiales sans useEffect
  const name = useSignal(project?.name ?? '')
  const teamId = useSignal<number | null>(project?.teamId ?? null) //user.data?.teamIds[0] ?? null

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
        <label class='form-control w-full'>
          <span class='label label-text text-sm'>Name</span>
          <input
            type='text'
            value={name.value}
            onInput={(e) => (name.value = (e.target as HTMLInputElement).value)}
            required
            class='input input-bordered w-full'
          />
        </label>

        <label class='form-control w-full'>
          <span class='label label-text text-sm'>Team</span>
          <select
            value={teamId.value ?? ''}
            onChange={(e) => (teamId.value = Number(e.currentTarget.value))}
            required
            class='select select-bordered w-full'
          >
            {teams.value.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <div class='modal-action'>
          <button type='button' class='btn btn-ghost' onClick={closeDialog}>
            Cancel
          </button>
          <button type='submit' class='btn btn-primary'>
            Save
          </button>
        </div>
      </form>
    </DialogModal>
  )
}

/* ---------- Teams Management Dialog ---------- */
function TeamsManagementDialog() {
  const id = url.params.dialog
  const selectedTeamId = useSignal<number>(teams.value[0]?.id ?? 0)
  const newTeamName = useSignal('')
  const tab = useSignal<'members' | 'projects' | 'settings'>('members')

  if (id !== 'manage-teams') return null

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
          {/* Sidebar */}
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
                <input
                  type='text'
                  placeholder='New team name'
                  value={newTeamName.value}
                  onInput={(e) => (newTeamName.value = e.currentTarget.value)}
                  class='input input-bordered input-sm w-full mb-2'
                />
                <button
                  type='button'
                  class='btn btn-sm btn-primary w-full'
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

          {/* Contenu principal */}
          <main class='flex-1 p-4 overflow-y-auto'>
            {selectedTeam
              ? (
                <>
                  <h3 class='text-lg font-semibold mb-4'>
                    {selectedTeam.name}
                  </h3>

                  {/* Onglets */}
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

/* ---------- Settings ---------- */
function TeamSettingsSection({ team }: { team: Team }) {
  const name = useSignal(team.name)

  const save = () => {
    if (!name.value.trim()) return
    saveTeam({ id: team.id, name: name.value })
    toast('Team updated.')
  }

  const del = () => {
    deleteTeam(team.id)
    closeDialog()
  }

  return (
    <div class='space-y-6 max-w-md'>
      <div>
        <label class='label'>
          <span class='label-text font-medium'>Team Name</span>
        </label>
        <input
          type='text'
          value={name.value}
          onInput={(e) => (name.value = e.currentTarget.value)}
          class='input input-bordered w-full'
        />
        <button
          type='button'
          class='btn btn-primary btn-sm mt-2'
          onClick={save}
        >
          Save
        </button>
      </div>

      <div class='divider' />

      <div>
        <h4 class='font-medium mb-2 text-error'>Danger Zone</h4>
        <button type='button' class='btn btn-error btn-sm' onClick={del}>
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
            <tr key={u.id} class='border-b border-divider'>
              <td class='py-3'>
                <div class='font-medium truncate'>{u.name}</div>
                <div class='text-text2 truncate'>{u.email}</div>
              </td>
              <td class='py-3'>{u.isAdmin ? 'Admin' : 'Member'}</td>
              <td class='py-3 text-right'>
                <input
                  type='checkbox'
                  class='toggle toggle-sm toggle-primary'
                  checked={u.teamIds.includes(team.id)}
                  onChange={(e) => {
                    const checked = (e.target as HTMLInputElement).checked
                    if (checked) {
                      addUserToTeam(u.id, team.id)
                    } else removeUserFromTeam(u.id, team.id)
                  }}
                />
              </td>
            </tr>
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
      <button
        type='button'
        class='btn btn-primary btn-sm mb-4'
        onClick={() => openDialog('add-project')}
      >
        + Add Project
      </button>

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
                  <tr key={p.slug} class='border-b border-divider'>
                    <td class='py-3 font-medium truncate'>{p.name}</td>
                    <td class='py-3 text-text2 truncate'>{p.slug}</td>
                    <td class='py-3 text-text2 whitespace-nowrap'>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td class='py-3 text-right flex gap-2 justify-end'>
                      <button
                        type='button'
                        onClick={() =>
                          openDialog('edit-project', { slug: p.slug })}
                        class='btn btn-ghost btn-xs'
                      >
                        Edit
                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          deleteProject(p.slug)}
                        class='btn btn-ghost btn-xs text-danger'
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

/* ---------- Delete Dialog ---------- */
function DeleteDialog() {
  const slug = url.params.slug
  const project = projects.value.find((p) => p.slug === slug)
  const confirmSlug = useSignal('')

  if (url.params.dialog !== 'delete-project') return null

  const canDelete = confirmSlug.value === slug

  const onDelete = () => {
    if (!canDelete) return
    projects.value = projects.value.filter((p) => p.slug !== slug)
    closeDialog()
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

      <label class='form-control w-full mb-6'>
        <span class='label label-text text-sm'>
          Type <span class='font-mono'>{slug}</span> to confirm
        </span>
        <input
          type='text'
          value={confirmSlug.value}
          onInput={(
            e,
          ) => (confirmSlug.value = (e.target as HTMLInputElement).value)}
          class='input input-bordered input-sm w-full'
          placeholder={slug || undefined}
        />
      </label>

      <div class='modal-action'>
        <button type='button' class='btn btn-ghost' onClick={closeDialog}>
          Cancel
        </button>
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
