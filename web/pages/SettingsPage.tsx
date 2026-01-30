import { A, url } from '@01edu/signal-router'
// import { api, ApiOutput } from '../../lib/api.ts'
import { deployments, project } from '../lib/shared.tsx'
import { ChevronRight, Cloud, Loader2, Settings, Users } from 'lucide-preact'

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
  { title, description }: { title: string; description: string },
) => (
  <div class='border-b border-base-300 bg-base-100 px-8 py-6'>
    <h1 class='text-xl font-semibold text-base-content'>{title}</h1>
    <p class='text-sm text-base-content/60 mt-1'>{description}</p>
  </div>
)

const ProjectSettingsPage = () => (
  <div class='flex flex-col h-full'>
    <PageHeader
      title='Project Settings'
      description='Configure general project settings and preferences.'
    />
    <div class='flex-1 overflow-y-auto p-8'>
      <div class='max-w-2xl'>
        <div class='text-base-content/40 text-sm'>
          Project settings content will go here.
        </div>
      </div>
    </div>
  </div>
)

const DeploymentsSettingsPage = () => (
  <div class='flex flex-col h-full'>
    <PageHeader
      title='Deployments'
      description='Manage deployment configurations and environments.'
    />
    <div class='flex-1 overflow-y-auto p-8'>
      <div class='max-w-2xl'>
        <div class='text-base-content/40 text-sm'>
          Deployment settings content will go here.
        </div>
      </div>
    </div>
  </div>
)

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
      <main class='flex-1 overflow-hidden'>
        <Content />
      </main>
    </div>
  )
}
