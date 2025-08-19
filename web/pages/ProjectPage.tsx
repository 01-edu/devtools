import { navigate, url } from '../lib/router.tsx'
import { PageLayoutWithSideBar } from '../components/Layout.tsx'
import { DeploymentPage } from './project/DeploymentPage.tsx'
import { TasksPage } from './project/TaskPage.tsx'
import { SettingsPage } from './project/SettingsPage.tsx'

const pageMap = {
  deployment: <DeploymentPage />,
  tasks: <TasksPage />,
  settings: <SettingsPage />,
}

export function ProjectPage() {
  const { nav } = url.params
  if (!nav || !pageMap[nav as keyof typeof pageMap]) {
    navigate({ params: { nav: 'deployment' } })
    return null
  }
  return (
    <PageLayoutWithSideBar>
      {pageMap[nav as keyof typeof pageMap]}
    </PageLayoutWithSideBar>
  )
}
