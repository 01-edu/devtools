import { effect } from '@preact/signals'
import { navigate, url } from '@01edu/signal-router'
import { Sidebar } from '../components/SideBar.tsx'
import { user } from '../lib/session.ts'
import { SettingsPage } from './SettingsPage.tsx'
import { deployments, project, sidebarItems } from '../lib/shared.tsx'

effect(() => {
  const path = url.path
  const slug = path.split('/')[2]
  if (slug) {
    project.fetch({ slug })
    deployments.fetch({ project: slug })
  }
})

export function ProjectPage() {
  const sbi = url.params.sbi || Object.keys(sidebarItems)[0]
  const Component = sidebarItems[sbi as keyof typeof sidebarItems]?.component ||
    (user.data?.isAdmin && sbi === 'settings' ? SettingsPage : null)

  if (!Component) {
    return null
  }

  if (!project.pending && !project.data) {
    navigate({ href: '/projects', params: undefined, replace: true })
    return null
  }

  return (
    <div class='drawer lg:drawer-open flex-1 min-h-0'>
      <input id='drawer-toggle' type='checkbox' class='drawer-toggle' />
      <div class='drawer-content flex flex-col overflow-hidden h-full min-h-0'>
        <Component />
      </div>
      <Sidebar
        sidebarItems={sidebarItems}
        sbi={sbi}
        title={project.data?.name}
      />
    </div>
  )
}
