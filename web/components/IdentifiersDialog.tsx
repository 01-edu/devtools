import { navigate, url } from '@01edu/signal-router'
import type { TargetedEvent } from 'preact'
import { effect } from '@preact/signals'
import { Loader2 } from 'lucide-preact'
import { DialogModal } from './Dialog.tsx'
import { api } from '../lib/api.ts'
import { user } from '../lib/session.ts'

const getIdentifiers = api['GET/api/user/identifiers'].signal()
const updateIdentifiers = api['PUT/api/user/identifiers'].signal()

const targetId = () => (user.data?.isAdmin && url.params.linkid) || undefined

const clearTarget = () => navigate({ params: { linkid: null, linkname: null } })

effect(() => {
  if (url.params.dialog === 'identifiers') {
    const id = targetId()
    getIdentifiers.fetch(id ? { id } : undefined)
  }
})

const fields = [
  ['githubLogin', 'GitHub login'],
  ['discordId', 'Discord user ID'],
  ['jiraAccountId', 'Jira account ID'],
] as const

const handleSubmit = async (e: TargetedEvent<HTMLFormElement>) => {
  e.preventDefault()
  const fd = new FormData(e.currentTarget)
  await updateIdentifiers.fetch({
    id: targetId(),
    githubLogin: (fd.get('githubLogin') as string) || undefined,
    discordId: (fd.get('discordId') as string) || undefined,
    jiraAccountId: (fd.get('jiraAccountId') as string) || undefined,
  })
  navigate({ params: { dialog: null } })
  clearTarget()
}

export const IdentifiersDialog = () => {
  const link = getIdentifiers.data
  const targetName = user.data?.isAdmin ? url.params.linkname : undefined
  return (
    <DialogModal id='identifiers' onClose={clearTarget}>
      <h3 class='text-lg font-bold mb-4'>
        Linked accounts{targetName ? ` — ${targetName}` : ''}
      </h3>
      {!link
        ? <Loader2 class='w-5 h-5 animate-spin' />
        : (
          <form onSubmit={handleSubmit} class='space-y-4'>
            {fields.map(([name, label]) => (
              <div class='form-control w-full' key={name}>
                <label class='label'>
                  <span class='label-text'>{label}</span>
                </label>
                <input
                  name={name}
                  defaultValue={link[name] || ''}
                  class='input input-bordered w-full'
                />
              </div>
            ))}
            {updateIdentifiers.error && (
              <div class='text-error text-xs px-1'>
                {updateIdentifiers.error.message}
              </div>
            )}
            <div class='modal-action'>
              <button
                type='submit'
                class='btn btn-primary'
                disabled={!!updateIdentifiers.pending}
              >
                {updateIdentifiers.pending
                  ? <Loader2 class='w-4 h-4' />
                  : 'Save'}
              </button>
            </div>
          </form>
        )}
    </DialogModal>
  )
}
