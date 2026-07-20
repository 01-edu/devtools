import { Signal } from '@preact/signals'
import { AlertTriangle, CheckCircle2 } from 'lucide-preact'

const toastSignal = new Signal<
  { message: string; type: 'info' | 'error' } | null
>(null)

export function toast(message: string, type: 'info' | 'error' = 'info') {
  toastSignal.value = { message, type }
  setTimeout(() => (toastSignal.value = null), 3000)
}

export const Toast = () => {
  if (!toastSignal.value) return null
  return (
    <div class='fixed bottom-4 right-4 bg-base-200 shadow-lg rounded-lg p-4 text-sm flex items-center gap-3 z-[100] border border-base-300'>
      {toastSignal.value.type === 'error'
        ? <AlertTriangle class='w-5 h-5 text-error' />
        : <CheckCircle2 class='w-5 h-5 text-success' />}
      <span class='text-base-content'>{toastSignal.value.message}</span>
    </div>
  )
}
