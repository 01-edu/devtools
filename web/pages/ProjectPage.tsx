import { effect } from '@preact/signals'
import { api } from '../lib/api.ts'
import { navigate, url } from '../lib/router.tsx'
import { BarChart3, HardDrive, ListTodo } from 'lucide-preact'
import { Sidebar, SidebarItem } from '../components/SideBar.tsx'
import { DeploymentPage } from './DeploymentPage.tsx'
import { user } from '../lib/session.ts'

export const deployments = api['GET/api/project/deployments'].signal()

const project = api['GET/api/project'].signal()

effect(() => {
  const path = url.path
  const slug = path.split('/')[2]
  if (slug) {
    project.fetch({ slug })
    deployments.fetch({ project: slug })
  }
})


export const sidebarItems: Record<string, SidebarItem> = {
  'deployment': { icon: HardDrive, label: 'Deployment', component: DeploymentPage },
  'dashboards': { icon: BarChart3, label: 'Dashboards', component: DeploymentPage },
  'tasks': { icon: ListTodo, label: 'Tasks', component: DeploymentPage },
}

export function ProjectPage() {
  const sbi = url.params.sbi || Object.keys(sidebarItems)[0]
  const Component = sidebarItems[sbi as keyof typeof sidebarItems]?.component ||
    (user.data?.isAdmin && sbi === 'settings' ? DeploymentPage : null)

  if (!Component) {
    return null
  }

  if (!project.pending && !project.data) {
    navigate({ href: '/projects', params: undefined })
    return null
  }

  return (
    <div class='drawer lg:drawer-open'>
      <input id='drawer-toggle' type='checkbox' class='drawer-toggle' />
      <div class='drawer-content flex flex-col'>
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
