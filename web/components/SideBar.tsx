import {
  ChevronsLeft,
  ChevronsRight,
  HardDrive,
  ListTodo,
  LucideIcon,
  Settings,
} from 'lucide-preact'
import { A, LinkProps, url } from '../lib/router.tsx'
import { user } from '../lib/session.ts'

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
    } ${url.params.sidebar_collapsed === 'true' ? 'justify-center' : ''}`}
    replace
  >
    <Icon class='h-5 w-5' />
    {url.params.sidebar_collapsed !== 'true' && <span>{children}</span>}
  </A>
)

export const SideBar = () => {
  const { nav, sidebar_collapsed } = url.params
  const isCollapsed = sidebar_collapsed === 'true'
  return (
    <div
      class={`relative h-full border-r border-base-300 bg-base-200 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div class='flex h-[calc(100vh-4rem)] flex-col'>
        <div
          class={`flex items-center border-b border-base-300 p-4 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!isCollapsed && <h2 class='text-lg font-semibold'>Project</h2>}
          <A
            params={{
              ...url.params,
              sidebar_collapsed: isCollapsed ? null : 'true',
            }}
            replace
            class='rounded-lg p-2 text-base-content/70 hover:bg-base-300'
          >
            {isCollapsed ? <ChevronsRight /> : <ChevronsLeft />}
          </A>
        </div>
        <nav class='flex-1 space-y-2 p-4'>
          <NavLink
            current={nav === 'deployment'}
            params={{ ...url.params, nav: 'deployment' }}
            icon={HardDrive}
          >
            Deployment
          </NavLink>
          <NavLink
            current={nav === 'tasks'}
            params={{ ...url.params, nav: 'tasks' }}
            icon={ListTodo}
          >
            Tasks
          </NavLink>
        </nav>
        <div
          class={`border-t border-base-300 p-4 ${
            user.data?.isAdmin ? '' : 'opacity-50 pointer-events-none'
          }`}
        >
          <NavLink
            current={nav === 'settings'}
            {...user.data?.isAdmin
              ? { params: { ...url.params, nav: 'settings' } }
              : {}}
            icon={Settings}
          >
            Settings
          </NavLink>
        </div>
      </div>
    </div>
  )
}
