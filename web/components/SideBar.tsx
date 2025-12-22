import { JSX } from 'preact'
import {
  ChevronsLeft,
  ChevronsRight,
  LucideIcon,
  Settings,
} from 'lucide-preact'
import { user } from '../lib/session.ts'
import { A, url } from '@01edu/signal-router'

export type SidebarItem = {
  label: string
  icon: LucideIcon
  component: () => JSX.Element
}

export function Sidebar(
  { sidebarItems, sbi, title }: {
    sidebarItems: Record<string, SidebarItem>
    sbi?: string
    title?: string
  },
) {
  const sb = url.params.sb
  return (
    <div class='drawer-side'>
      <div
        class={`${
          sb ? 'w-64' : 'w-16'
        } min-h-94/100 bg-base-100 border-r border-base-300 flex flex-col transition-all duration-300`}
      >
        <div class='p-4 border-b border-base-300'>
          <div class='flex items-center justify-between'>
            {sb && (
              <span class='text-sm font-medium rounded bg-base-200 w-7/10 py-1 px-2 text-center text-base-content/60'>
                {title || 'Project Name'}
              </span>
            )}
            <A
              params={{ sb: sb ? null : 'true' }}
              class='p-2 hover:bg-base-200 rounded'
            >
              {sb
                ? <ChevronsLeft class='h-4 w-4 text-base-content/60' />
                : <ChevronsRight class='h-4 w-4 text-base-content/60' />}
            </A>
          </div>
        </div>

        <div class='flex-1 p-2'>
          <ul class='menu w-full space-y-1'>
            {Object.entries(sidebarItems).map(([slug, item]) => (
              <li key={slug}>
                <A
                  class={`${sbi === slug ? 'bg-base-200' : ''}`}
                  data-tip={sb ? undefined : item.label}
                  params={{ sbi: slug }}
                  replace
                >
                  <item.icon class='h-4 w-4' />
                  {sb && item.label}
                </A>
              </li>
            ))}
          </ul>
        </div>

        <div class='p-4 border-t border-base-300'>
          <A
            params={{ sbi: 'settings' }}
            replace
            class={`rounded p-2 w-full flex items-center gap-2 ${
              user.data?.isAdmin
                ? 'settings' === sbi ? 'bg-primary text-primary-content' : ''
                : 'opacity-50 pointer-events-none'
            }`}
          >
            <Settings class='h-4 w-4' />
            {sb && 'Settings'}
          </A>
        </div>
      </div>
    </div>
  )
}
