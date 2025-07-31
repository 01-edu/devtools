export type ModalField = {
  key: string
  type: 'text' | 'email' | 'select'
  label: string
  placeholder?: string
  required?: boolean
  options?: readonly string[] // uniquement si type === 'select'
}

export type ModalConfig = {
  title: string
  fields: readonly ModalField[]
  onSubmit?: (data: Record<string, unknown>) => void | Promise<void>
}

export const MODAL_CONFIGS: Record<string, ModalConfig> = {
  'add-p': {
    title: 'Add platform',
    fields: [
      {
        key: 'name',
        type: 'text' as const,
        label: 'Project name',
        placeholder: 'e.g. My Awesome App',
        required: true,
      },
      {
        key: 'email',
        type: 'email' as const,
        label: 'Email',
        placeholder: 'e.g. My Awesome App',
        required: true,
      },
      {
        key: 'env',
        type: 'select' as const,
        label: 'Environment',
        options: ['development', 'production'],
      },
      {
        key: 'bsId',
        type: 'text' as const,
        label: 'BetterStack ID',
        placeholder: 'bs-12345 (optional)',
        required: false,
      },
    ],
  },
  'rn-p': {
    title: 'Rename project',
    fields: [
      {
        key: 'newName',
        type: 'text',
        label: 'New project name',
        placeholder: 'New name',
        required: true,
      },
    ],
  },
} as const
