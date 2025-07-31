// ProjectsPage.tsx – 
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  Lock,
  Search,
} from 'lucide-preact'
import { useState } from 'preact/hooks'
import { signal, useComputed } from '@preact/signals'
import { A, navigate, url } from '../lib/router.tsx'
import { MODAL_CONFIGS } from '../lib/modal-config.ts'

/* ---------- Types ---------- */
type Project = {
  projectId: number
  projectName: string
  betterstackId?: string
  createdAt: string
  environment: 'prod' | 'dev'
}

interface User {
  id: number
  isAdmin: boolean
  authorizedProjects: number[]
}

const Projects: Project[] = [
  {
    projectId: 1,
    projectName: 'Tomorrow School',
    betterstackId: 'bs-12345',
    createdAt: '2023-10-15',
    environment: 'prod',
  },
  {
    projectId: 2,
    projectName: 'Trial Project',
    betterstackId: 'bs-67890',
    createdAt: '2023-09-22',
    environment: 'dev',
  },
  {
    projectId: 3,
    projectName: 'Digital Academy',
    betterstackId: 'bs-54321',
    createdAt: '2023-11-05',
    environment: 'prod',
  },
  {
    projectId: 4,
    projectName: 'Zone01 Normandy',
    createdAt: '2023-08-10',
    environment: 'prod',
  },
  {
    projectId: 5,
    projectName: 'ADAM Jerusalem',
    betterstackId: 'bs-1111134443345345345345344342342342434',
    createdAt: '2023-07-20',
    environment: 'dev',
  },
]

const currentUser = signal<User>({
  id: 1,
  isAdmin: true,
  authorizedProjects: [1, 3, 5],
})

const isAuthorizedForProject = (projectId: number) =>
  currentUser.value.isAdmin ||
  currentUser.value.authorizedProjects.includes(projectId)

const truncateText = (text: string, maxLength: number) =>
  text.length > maxLength ? text.substring(0, maxLength) + '…' : text


const ProjectCard = ({ Project }: { Project: Project }) => {
  const authorized = isAuthorizedForProject(Project.projectId)
  return (
    <A
      href={authorized ? `/projects/${Project.projectId}` : undefined}
      class="block hover:no-underline"
    >
      <div class="card bg-base-200 border border-base-300 hover:bg-base-300 transition-colors relative">
        <div class="card-body p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class={`badge ${Project.environment === 'prod' ? 'badge-success' : 'badge-warning'}`} />
              <div class="min-w-0">
                <h3
                  class="font-semibold text-base-content truncate"
                  title={Project.projectName}
                >
                  {truncateText(Project.projectName, 20)}
                </h3>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/70 mt-1">
                  <span title={`ID: ${Project.projectId}`}>
                    ID: {Project.projectId}
                  </span>
                  {Project.betterstackId && (
                    <span title={`BS: ${Project.betterstackId}`}>
                      BS: {truncateText(Project.betterstackId, 10)}
                    </span>
                  )}
                  <div class="flex items-center gap-1">
                    <Calendar class="w-3 h-3" />
                    <span>{Project.createdAt}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                class="btn btn-ghost btn-sm btn-circle"
              >
                {!authorized ? <Lock class="w-4 h-4" /> : <ArrowRight class="w-4 h-4" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </A>
  )
}

export function ProjectsPage() {
  const prodOpen = useComputed(() => url.params.prodopen !== 'false')
  const devOpen  = useComputed(() => url.params.devopen  !== 'false')
  const toggleProd = () => navigate({ params: { prodopen: prodOpen.value ? 'false' : null } })
  const toggleDev  = () => navigate({ params: { devopen : devOpen.value  ? 'false' : null } })
  const [searchTerm, setSearchTerm] = useState('')
  const filtered = Projects.filter(
    (p) =>
      p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.betterstackId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.projectId.toString().includes(searchTerm),
  )

  const prodProjects = filtered.filter((p) => p.environment === 'prod')
  const devProjects  = filtered.filter((p) => p.environment === 'dev')

  /* --- callback modal --- */
  MODAL_CONFIGS['add-p'].onSubmit = (data) => console.log('Add platform', data)

  return (
    <div class="h-full max-w-7xl mx-auto overflow-y-auto">
      <div class="bg-base-100 h-full p-4 sm:p-6">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 sm:mb-8">
          <h1 class="text-2xl sm:text-3xl font-bold text-base-content">Projects</h1>

          <div class="flex flex-row items-center gap-3 w-full max-w-sm">
            <div class="form-control flex-1">
              <label class="input input-bordered flex items-center gap-2">
                <Search class="w-4 h-4 opacity-70" />
                <input
                  type="text"
                  placeholder="Search Projects…"
                  value={searchTerm}
                  onInput={(e) => setSearchTerm(e.currentTarget.value)}
                />
              </label>
            </div>

            <button
              onClick={() => navigate({ params: { modal: 'add-p' } })}
              type="button"
              class="btn btn-primary shrink-0"
              disabled={!currentUser.value.isAdmin}
            >
              Add Project
            </button>
          </div>
        </div>

        <div class="max-h-[calc(100vh-12rem)] pr-2 pb-16 scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-base-100">
          {prodProjects.length > 0 && (
            <details open={prodOpen.value} class="mb-6 sm:mb-8 group">
              <summary
                onClick={(e) => {
                  e.preventDefault()
                  toggleProd()
                }}
                class="list-none cursor-pointer flex items-center mb-3 sm:mb-4"
              >
                <h2 class="text-lg font-semibold text-base-content mr-2">
                  Production ({prodProjects.length})
                </h2>
                <ChevronDown
                  class={`w-4 h-4 transition-transform ${prodOpen.value ? 'rotate-180' : ''}`}
                />
              </summary>

              <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mt-2">
                {prodProjects.map((p) => (
                  <ProjectCard key={p.projectId} Project={p} />
                ))}
              </div>
            </details>
          )}

          {devProjects.length > 0 && (
            <details open={devOpen.value} class="mb-6 sm:mb-8 group">
              <summary
                onClick={(e) => {
                  e.preventDefault()
                  toggleDev()
                }}
                class="list-none cursor-pointer flex items-center mb-3 sm:mb-4"
              >
                <h2 class="text-lg font-semibold text-base-content mr-2">
                  Development ({devProjects.length})
                </h2>
                <ChevronDown
                  class={`w-4 h-4 transition-transform ${devOpen.value ? 'rotate-180' : ''}`}
                />
              </summary>

              <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mt-2">
                {devProjects.map((p) => (
                  <ProjectCard key={p.projectId} Project={p} />
                ))}
              </div>
            </details>
          )}

          {filtered.length === 0 && (
            <div class="text-center py-8 sm:py-12">
              <Search class="w-12 h-12 mx-auto mb-4 opacity-40" />
              <h3 class="text-lg font-medium">No projects found</h3>
            </div>
          )}

          <div class="h-8" />
        </div>

        <div class="sticky bottom-0 h-8 bg-gradient-to-t from-base-100 to-transparent pointer-events-none -mt-8" />
      </div>
    </div>
  )
}