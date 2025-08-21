import { JSX } from 'preact'
import { useId } from 'preact/hooks'
import { A, LinkProps } from '../lib/router.tsx'

// Card component
export const Card = (
  { children, title, description }: {
    title: string
    description?: string
    children: JSX.Element | JSX.Element[]
  },
) => (
  <div class='bg-surface rounded-lg border border-divider shadow-sm bg-base-100'>
    <div class='p-4 sm:p-6'>
      <h3 class='text-lg font-semibold text-text'>{title}</h3>
      {description && (
        <p class='mt-1 text-sm text-text-secondary'>{description}</p>
      )}
    </div>
    <div class='p-4 sm:p-6 border-t border-divider'>
      {children}
    </div>
  </div>
)

// Input component
export const Input = (
  { label, name, note, ...props }:
    & { label: string; name: string; note?: string }
    & JSX.InputHTMLAttributes<HTMLInputElement>,
) => {
  const id = useId()
  return (
    <div>
      <label for={id} class='block text-sm font-medium text-text-secondary'>
        {label}
      </label>
      <input
        id={id}
        name={name}
        class='mt-1 block w-full px-3 py-2 bg-bg border border-divider rounded-md shadow-sm placeholder-text-disabled focus:outline-none focus:ring-primary focus:border-primary sm:text-sm'
        {...props}
      />
      {note && <p class='mt-2 text-sm text-text-secondary'>{note}</p>}
    </div>
  )
}

// Button component
export const Button = (
  { children, variant = 'primary', ...props }:
    & {
      variant?: 'primary' | 'secondary' | 'danger'
    }
    & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'class' | 'style'>
    & Partial<LinkProps>,
) => {
  const baseClasses =
    'inline-flex justify-center py-2 px-4 border shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2'

  const variants = {
    primary:
      'border-transparent text-white bg-primary hover:bg-primary-hover focus:ring-primary',
    secondary:
      'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-indigo-500',
    danger:
      'border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500',
  }

  if (props.href || props.hash || props.params) {
    return (
      <A
        class={[baseClasses, variants[variant]].join(' ')}
        {...props}
      >
        {children}
      </A>
    )
  }

  return (
    <button
      class={[baseClasses, variants[variant]].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}

// Switch component
export const Switch = (
  { label, note, ...props }: {
    label: string
    note?: string
    // checked: boolean
  } & JSX.InputHTMLAttributes<HTMLInputElement>,
) => {
  const id = useId()
  return (
    <div class='flex items-center justify-between'>
      <span class='flex-grow flex flex-col'>
        <label for={id} class='text-sm font-medium text-text-secondary'>
          {label}
        </label>
        {note && <p class='text-sm text-text-tertiary'>{note}</p>}
      </span>
      <div class='relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in'>
        <input
          type='checkbox'
          id={id}
          class='absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400'
          {...props}
        />
        <label
          for={id}
          class='block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer'
        >
        </label>
      </div>
    </div>
  )
}

// Note component
export const Note = ({ children }: { children: string }) => (
  <p class='mt-2 text-sm text-text-secondary'>{children}</p>
)
