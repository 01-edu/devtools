import { navigate, url } from '@01edu/signal-router'
import type { TargetedEvent } from 'preact'
import { Loader2 } from 'lucide-preact'
import { DialogModal } from './Dialog.tsx'
import { api } from '../lib/api.ts'
import { user } from '../lib/session.ts'
import { selectedTeam } from '../pages/ProjectsPage.tsx'

const updateIdentifiers = api['PUT/api/user/identifiers'].signal()

const targetId = () => (user.data?.isAdmin && url.params.linkid) || undefined

const targetMember = () => {
  const id = targetId()
  return id ? selectedTeam.data?.members.find((m) => m.id === id) : undefined
}

// Self: `user.data` already carries the linked ids (GET/api/user/me). An
// admin-targeted member: looked up from `selectedTeam.data`, already
// fetched by the Team Management dialog — no extra request needed.
const current = () => targetMember() ?? user.data

const clearTarget = () => navigate({ params: { linkid: null } })

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
  const target = current()
  const targetName = targetMember()?.name
  return (
    <DialogModal id='identifiers' onClose={clearTarget}>
      <h3 class='text-lg font-bold mb-4'>
        Linked accounts{targetName ? ` — ${targetName}` : ''}
      </h3>
      <form onSubmit={handleSubmit} class='space-y-4'>
        {fields.map(([field, label]) => (
          <div class='form-control w-full' key={field}>
            <label class='label'>
              <span class='label-text'>{label}</span>
            </label>
            <input
              name={field}
              defaultValue={target?.[field] || ''}
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
            {updateIdentifiers.pending ? <Loader2 class='w-4 h-4' /> : 'Save'}
          </button>
        </div>
      </form>
    </DialogModal>
  )
}
