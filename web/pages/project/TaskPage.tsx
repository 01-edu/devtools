import { Project } from '../../../api/schema.ts'
import { PageContent, PageHeader } from '../../components/Layout.tsx'

export const TasksPage = ({ project }: { project: Project }) => {
  return (
    <>
      <PageHeader>
        <h1 class='text-xl sm:text-2xl font-semibold text-text'>
          Project: {project.projectName}
        </h1>
      </PageHeader>
      <PageContent>
        <p>This is the project page for {project.projectName}.</p>
      </PageContent>
    </>
  )
}
