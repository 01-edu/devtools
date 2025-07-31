import { render } from 'preact'
import { LoginPage } from './pages/LoginPage.tsx'
import { ProjectsPage } from './pages/ProjectsPage.tsx'
import { BackgroundPattern } from './components/BackgroundPattern.tsx'
import { Header } from './layout.tsx'
import { url } from './lib/router.tsx'
import { Modal } from './components/Modal.tsx'

const renderPage = () => {
  const path = url.path
  if (path === '/login') {
    return <LoginPage />
  }
  return <ProjectsPage />
}
const App = () => {
  return (
    <div className='h-screen flex flex-col bg-base-100 overflow-hidden'>
      <div className='fixed inset-0 '>
        <BackgroundPattern />
      </div>
      <header className='w-full shrink-0'>
        <Header />
      </header>
      <main className='w-full flex-1 relative'>
        <Modal />
        {renderPage()}
      </main>
    </div>
  )
}

const root = document.getElementById('app')
if (!root) throw new Error('Unable to find root element #app')
render(<App />, root)
