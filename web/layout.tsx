import { effect, signal } from '@preact/signals'
import { Code, Github, Moon, Sun } from 'lucide-preact'

const $theme = signal(localStorage.theme || 'dark')

effect(() => {
  document.documentElement.dataset.theme = $theme.value
  localStorage.theme = $theme.value
})

const toggleTheme = () => {
  $theme.value = $theme.peek() === 'dark' ? 'light' : 'dark'
}

const _UserInfo = () => {
  //   if (!user.data) return null

  return (
    <div class='flex items-center gap-2'>
      <div class='flex flex-col items-end'>
        <span class='text-sm font-medium text-base-content select-none'>
          {/* {user.data.userFullName} */}
        </span>

        {
          /* {user.data && (
          <A href='/api/logout' class='text-xs whitespace-nowrap'>
            <span class='underline'>Logout</span>{' '}
            <LogOut size='12' class='inline-block' />
          </A>
        )} */
        }
      </div>
      {
        /* {user.data.userPicture && (
        <img
          src={`/api/picture?hash=${user.data.userPicture}`}
          alt='profile picture'
          class='w-12 h-12 rounded-full pointer-events-none'
        />
      )} */
      }
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
  <header class='navbar bg-base-300 text-base-content pr-6'>
    <div class='flex-1'>
      <a class='btn btn-ghost text-xl gap-2'>
        <Code className='w-8 h-8 text-primary' />
        <span class='font-bold'>DevTools</span>
      </a>
    </div>
    <div class='flex-none gap-6'>
      <a
        href='https://github.com/01-edu'
        target='_blank'
        rel='noopener noreferrer'
        class='btn btn-ghost btn-square text-base-content hover:text-primary mr-5'
        aria-label='GitHub repository'
      >
        <Github className='w-5 h-5' />
      </a>
      <SwitchTheme />
      {
        /* {!['/login'].includes(url.path) && (
          <UserInfo />
        )}  */
      }
    </div>
  </header>
)
