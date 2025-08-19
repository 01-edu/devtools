import { PageContent, PageHeader } from '../../components/Layout.tsx'
import { url } from '../../lib/router.tsx'

export const TasksPage = () => {
  const slug = url.path.split('/')[2]
  return (
    <>
      <PageHeader>
        <h1 class='text-xl sm:text-2xl font-semibold text-text'>
          Project: {slug}
        </h1>
      </PageHeader>
      <PageContent>
        <p>This is the project page for {slug}.</p>
      </PageContent>
    </>
  )
}
