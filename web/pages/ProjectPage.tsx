import { A, navigate, url } from '../lib/router.tsx'
import {
  PageContent,
  PageHeader,
  PageLayoutWithSideBar,
} from '../components/Layout.tsx'
import { DeploymentPage } from './project/DeploymentPage.tsx'
import { TasksPage } from './project/TaskPage.tsx'
import { SettingsPage } from './project/SettingsPage.tsx'
import { api } from '../lib/api.ts'
import { effect } from '@preact/signals'

const pageMap = {
  deployment: DeploymentPage,
  tasks: TasksPage,
  settings: SettingsPage,
}

const project = api['GET/api/project'].signal()

effect(() => {
  const path = url.path
  const projectSlug = path.split('/')[2]
  if (projectSlug) {
    project.fetch({ projectSlug })
  }
})

export function ProjectPage() {
  const { nav } = url.params
  if (!nav || !pageMap[nav as keyof typeof pageMap]) {
    navigate({ params: { nav: 'deployment' } })
    return null
  }

  if (project.pending) {
    return (
      <PageLayoutWithSideBar>
        <div class='text-center py-10'>Loading...</div>
      </PageLayoutWithSideBar>
    )
  }

  if (!project.data) {
    return (
      <>
        <PageHeader>
          <h1 class='text-xl sm:text-2xl font-semibold text-text'>
            Deployments
          </h1>
        </PageHeader>
        <PageContent>
          <div class='text-center py-10'>
            <p class='text-text2'>
              Please select a project to view deployments.
            </p>
            <A href='/projects' class='btn btn-primary mt-4'>Go to Projects</A>
          </div>
        </PageContent>
      </>
    )
  }

  const Component = pageMap[nav as keyof typeof pageMap]
  return (
    <PageLayoutWithSideBar>
      <Component project={project.data} />
    </PageLayoutWithSideBar>
  )
}
