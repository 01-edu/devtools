import { SideBar } from '../components/SideBar.tsx'
import { url } from '../lib/router.tsx'
import { PageContent, PageHeader, PageLayout } from './ProjectsPage.tsx'

export function ProjectPage() {
  const slug = url.path.split('/')[2]

  return (
    <div class='h-screen flex bg-bg'>
      <SideBar />
      <div class='flex-1 flex-col'>
        <PageLayout>
          <PageHeader>
            <h1 class='text-xl sm:text-2xl font-semibold text-text'>
              Project: {slug}
            </h1>
          </PageHeader>
          <PageContent>
            <p>This is the project page for {slug}.</p>
          </PageContent>
        </PageLayout>
      </div>
    </div>
  )
}
