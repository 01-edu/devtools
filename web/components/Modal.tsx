// Modal.tsx – version DaisyUI par défaut avec structure de formulaire correcte
import { useComputed } from '@preact/signals'
import { X } from 'lucide-preact'
import { navigate, url } from '../lib/router.tsx'
import { MODAL_CONFIGS } from '../lib/modal-config.ts'

type ModalId = keyof typeof MODAL_CONFIGS

const close = () => navigate({ params: { modal: null } })

export function Modal() {
  const modalId = useComputed(() => url.params.modal as ModalId | undefined)
  const config = useComputed(
    () => (modalId.value ? MODAL_CONFIGS[modalId.value] : undefined),
  )

  const form = useComputed(() => {
    const data: Record<string, string> = {}
    config.value?.fields.forEach((f) => {
      data[f.key] = url.params[`${modalId}-${f.key}`] ?? ''
    })
    return data
  })

  if (!config.value) return null

  const setValue = (k: string, v: string) => {
    navigate({ params: { ...url.params, [`${modalId}-${k}`]: v || null } })
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    await config.value?.onSubmit?.(form.value)
    close()
  }

  return (
    <div class='modal modal-open'>
      <div class='modal-box'>
        <div class='flex items-center justify-between pb-3'>
          <h3 class='font-bold text-lg'>{config.value.title}</h3>
          <button
            type='button'
            class='btn btn-sm btn-circle btn-ghost'
            onClick={close}
          >
            <X class='w-4 h-4' />
          </button>
        </div>
        <form onSubmit={handleSubmit} class='space-y-4'>
          {config.value.fields.map((f) => (
            <div key={f.key} class='form-control w-full'>
              <label class='label'>
                <span class='label-text font-medium'>{f.label}</span>
              </label>
              {f.type !== 'select' && (
                <input
                  type={f.type}
                  class='input input-bordered w-full'
                  placeholder={f.placeholder}
                  value={form.value[f.key] ?? ''}
                  onInput={(e) => setValue(f.key, e.currentTarget.value)}
                  required={f.required}
                />
              )}
              {f.type === 'select' && (
                <select
                  class='select select-bordered w-full'
                  value={form.value[f.key] ?? ''}
                  onChange={(e) => setValue(f.key, e.currentTarget.value)}
                >
                  <option disabled value=''>Choose environment</option>
                  {f.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
          <div class='modal-action pt-4'>
            <button type='button' class='btn btn-ghost' onClick={close}>
              Cancel
            </button>
            <button type='submit' class='btn btn-primary'>Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}
