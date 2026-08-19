import { navigate, url } from '@01edu/signal-router'
import type { TargetedEvent } from 'preact'
import { Loader2 } from 'lucide-preact'
import { DialogModal } from './Dialog.tsx'
import { api } from '../lib/api.ts'
import { user } from '../lib/session.ts'
import { selectedTeam } from '../pages/ProjectsPage.tsx'
import { computed } from '@preact/signals'

const updateIdentifiers = api['PUT/api/user/identifiers'].signal()

const link = computed(() => {
  const targetId = (user.data?.isAdmin && url.params.linkid) || undefined
  if (!targetId) {
    return {
      id: user.data?.id,
      name: undefined as string | undefined,
      githubLogin: user.data?.githubLogin,
      discordId: user.data?.discordId,
      jiraAccountId: user.data?.jiraAccountId,
    }
  }
  const member = selectedTeam.data?.members.find((m) => m.id === targetId)
  return {
    id: targetId,
    name: member?.name,
    githubLogin: member?.githubLogin,
    discordId: member?.discordId,
    jiraAccountId: member?.jiraAccountId,
  }
})

const clearTarget = () => {
  navigate({ params: { linkid: null } })
  updateIdentifiers.reset()
}

const fields = [
  ['githubLogin', 'GitHub login'],
  ['discordId', 'Discord user ID'],
  ['jiraAccountId', 'Jira account ID'],
] as const

const handleSubmit = async (e: TargetedEvent<HTMLFormElement>) => {
  e.preventDefault()
  const fd = new FormData(e.currentTarget)
  await updateIdentifiers.fetch({
    id: link.value.id,
    githubLogin: (fd.get('githubLogin') as string) || undefined,
    discordId: (fd.get('discordId') as string) || undefined,
    jiraAccountId: (fd.get('jiraAccountId') as string) || undefined,
  })
  user.fetch()
  if (selectedTeam.data) selectedTeam.fetch({ id: selectedTeam.data.id })
}

export const IdentifiersDialog = () => {
  const target = link.value
  return (
    <DialogModal id='identifiers' onClose={clearTarget}>
      <h3 class='text-lg font-bold mb-4'>
        Linked accounts{target.name ? ` — ${target.name}` : ''}
      </h3>
      <form key={target?.id} onSubmit={handleSubmit} class='space-y-4'>
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
