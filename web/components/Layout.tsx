import { JSX } from 'preact'
import { SideBar } from './SideBar.tsx'

export const PageLayoutWithSideBar = (
  { children }: { children: JSX.Element | JSX.Element[] | null },
) => (
  <div class='h-screen flex bg-bg'>
    <SideBar />
    <div class='flex-1 flex flex-col'>
      {children}
    </div>
  </div>
)

export const PageLayout = (
  { children }: { children: JSX.Element | JSX.Element[] },
) => (
  <div class='h-screen flex justify-center bg-bg'>
    <div class='w-full max-w-7xl h-full bg-base-100 flex flex-col'>
      {children}
    </div>
  </div>
)

export const PageHeader = (
  { children }: { children: JSX.Element | JSX.Element[] },
) => (
  <header class='px-4 sm:px-6 py-4 bg-surface border-b border-divider'>
    <div class='flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4'>
      {children}
    </div>
  </header>
)

export const PageContent = (
  { children }: { children: JSX.Element | JSX.Element[] },
) => (
  <main class='flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-20'>{children}</main>
)
