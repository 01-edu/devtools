import { render } from 'preact'
import { LoginPage } from './pages/LoginPage.tsx'
import { BackgroundPattern } from './components/BackgroundPattern.tsx'
import { Header } from './layout.tsx'
import { user } from './lib/session.ts'

const renderPage = () => {
  if (user.pending) return
  if (!user.data) {
    return <LoginPage />
  }
  return (
    <div className='flex items-center justify-center h-full'>
      <h1 className='text-3xl font-bold text-base-content'>
        Welcome to the Dev Tools App!
      </h1>
    </div>
  )
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
