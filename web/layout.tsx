import { effect, signal } from '@preact/signals'
import { A, url } from '@01edu/signal-router'
import { Code, LogOut, Moon, Sun } from 'lucide-preact'
import { user } from './lib/session.ts'

const $theme = signal(localStorage.theme || 'dark')

effect(() => {
  document.documentElement.dataset.theme = $theme.value
  localStorage.theme = $theme.value
})

const toggleTheme = () => {
  $theme.value = $theme.peek() === 'dark' ? 'light' : 'dark'
}

const UserInfo = () => {
  if (!user.data) return null

  return (
    <div class='flex items-center gap-2'>
      <div class='flex flex-col items-end'>
        <span class='text-sm font-medium text-base-content select-none'>
          {user.data.fullName}
        </span>

        <A href='/api/logout' class='text-xs whitespace-nowrap'>
          <span class='underline'>Logout</span>{' '}
          <LogOut size={12} class='inline-block' />
        </A>
      </div>

      {user.data.picture && (
        <img
          src={`/api/picture?hash=${user.data.picture}`}
          alt='profile'
          class='w-10 h-10 rounded-full pointer-events-none'
        />
      )}
    </div>
  )
}

export const SwitchTheme = () => (
  <label class='swap swap-rotate'>
    <input
      type='checkbox'
      class='theme-controller'
      checked={$theme.value === 'dark'}
      onInput={toggleTheme}
    />
    <Moon class='swap-on w-5 h-5 fill-current text-base-content' />
    <Sun class='swap-off w-5 h-5 fill-current text-base-content' />
  </label>
)

export const Header = () => (
  <header class='navbar bg-base-300 text-base-content px-6'>
    <div class='flex-1'>
      <A
        href='/'
        class='btn btn-ghost text-xl gap-2 cursor-pointer'
      >
        <Code class='w-8 h-8 text-primary' />
        <span class='font-bold'>DevTools</span>
      </A>
    </div>

    <div class='flex items-center gap-4'>
      <SwitchTheme />
      {'/login' !== url.path && <UserInfo />}
    </div>
  </header>
)
