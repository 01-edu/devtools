import { signal } from '@preact/signals'
import {
  ChevronsLeft,
  ChevronsRight,
  HardDrive,
  LucideIcon,
  Settings,
} from 'lucide-preact'
import { A, LinkProps, url } from '../lib/router.tsx'

const isCollapsed = signal(false)

const NavLink = (
  { icon: Icon, children, current, ...props }: LinkProps & {
    current: boolean
    icon: LucideIcon
  },
) => (
  <A
    {...props}
    class={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      current
        ? 'bg-primary/10 text-primary'
        : 'text-base-content/70 hover:bg-base-300'
    } ${isCollapsed.value ? 'justify-center' : ''}`}
  >
    <Icon class='h-5 w-5' />
    {!isCollapsed.value && <span>{children}</span>}
  </A>
)

export const SideBar = () => {
  const { nav } = url.params
  return (
    <div
      class={`relative h-full border-r border-base-300 bg-base-200 transition-all duration-300 ease-in-out ${
        isCollapsed.value ? 'w-20' : 'w-64'
      }`}
    >
      <div class='flex h-full flex-col'>
        <div
          class={`flex items-center border-b border-base-300 p-4 ${
            isCollapsed.value ? 'justify-center' : 'justify-between'
          }`}
        >
          {!isCollapsed.value && <h2 class='text-lg font-semibold'>Project</h2>}
          <button
            type='button'
            onClick={() => (isCollapsed.value = !isCollapsed.value)}
            class='rounded-lg p-2 text-base-content/70 hover:bg-base-300'
          >
            {isCollapsed.value ? <ChevronsRight /> : <ChevronsLeft />}
          </button>
        </div>
        <nav class='flex-1 space-y-2 p-4'>
          <NavLink
            current={nav === 'deployment'}
            params={{ nav: 'deployment' }}
            icon={HardDrive}
          >
            Deployment
          </NavLink>
          <NavLink
            current={nav === 'tasks'}
            params={{ nav: 'tasks' }}
            icon={Settings}
          >
            Tasks
          </NavLink>
        </nav>
        <div class='border-t border-base-300 p-4'>
          <NavLink
            current={nav === 'settings'}
            params={{ nav: 'settings' }}
            icon={Settings}
          >
            Settings
          </NavLink>
        </div>
      </div>
    </div>
  )
}
