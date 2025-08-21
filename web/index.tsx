import { render } from 'preact'
import { LoginPage } from './pages/LoginPage.tsx'
import { ProjectsPage } from './pages/ProjectsPage.tsx'
import { BackgroundPattern } from './components/BackgroundPattern.tsx'
import { Header } from './layout.tsx'
import { user } from './lib/session.ts'
import { url } from './lib/router.tsx'
import { ProjectPage } from './pages/ProjectPage.tsx'

const renderPage = () => {
  if (user.pending) return
  if (!user.data) {
    return <LoginPage />
  }
  if (url.path.startsWith('/projects/')) {
    return <ProjectPage />
  }
  return <ProjectsPage />
}
const App = () => {
  return (
    <div className='h-screen flex flex-col bg-base-100 overflow-hidden'>
      <div className='fixed inset-0'>
        <BackgroundPattern />
      </div>
      <header className='w-full shrink-0 z-0'>
        <Header />
      </header>
      <main className='w-full flex-1 relative'>
        {renderPage()}
      </main>
    </div>
  )
}

const root = document.getElementById('app')
if (!root) throw new Error('Unable to find root element #app')
render(<App />, root)
