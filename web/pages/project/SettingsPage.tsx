import { useSignal } from '@preact/signals'
import { navigate, url } from '@01edu/signal-router'
import type { TargetedEvent } from 'preact'
import { PageContent, PageHeader } from '../../components/Layout.tsx'
import { Button, Card, Input, Switch } from '../../components/forms.tsx'
import { api, ApiOutput } from '../../lib/api.ts'
import { user } from '../../lib/session.ts'
import { deployments, project } from '../../lib/shared.tsx'

type Project = ApiOutput['GET/api/projects'][number]
type Deployment = ApiOutput['GET/api/project/deployments'][number]
type User = ApiOutput['GET/api/users'][number]

const users = api['GET/api/users'].signal()
users.fetch()

const team = api['GET/api/team'].signal()

function ProjectInfoForm() {
  const handleSubmit = (e: TargetedEvent<HTMLFormElement>) => {
    e.preventDefault()
  }

  return (
    <Card
      title='Project Information'
      description='Update your project name and repository URL.'
    >
      <form onSubmit={handleSubmit}>
        <div class='space-y-4'>
          <Input
            label='Project Name'
            name='projectName'
            defaultValue={project.data?.name}
            note='This is your project’s display name.'
          />
          <Input
            label='Repository URL'
            name='repositoryUrl'
            defaultValue={project.data?.repositoryUrl || ''}
            note='The URL of the Git repository for your project.'
          />
        </div>
        <div class='mt-6 flex justify-end'>
          <Button type='submit'>Save Changes</Button>
        </div>
      </form>
    </Card>
  )
}

function DeploymentForm({ deployment }: { deployment?: Deployment }) {
  const databaseEnabled = useSignal(deployment?.databaseEnabled || false)
  const handleSubmit = (e: TargetedEvent<HTMLFormElement>) => {
    e.preventDefault()
  }

  return (
    <Card title={deployment ? 'Edit Deployment' : 'Add Deployment'}>
      <form onSubmit={handleSubmit}>
        <div class='space-y-4'>
          <Input
            label='Deployment URL'
            name='url'
            defaultValue={deployment?.url}
            note='The publicly accessible URL of your deployment.'
          />
          <Switch
            label='Enable Logging'
            name='logsEnabled'
            defaultChecked={deployment?.logsEnabled}
            note='Generate ClickHouse credentials to send logs directly from your server.'
          />
          <Switch
            label='Enable Database'
            name='databaseEnabled'
            defaultChecked={databaseEnabled.value}
            onChange={(e) => databaseEnabled.value = e.currentTarget.checked}
            note='Provide an endpoint to execute SQL queries against your database.'
          />
          {databaseEnabled.value && (
            <div class='pl-4 space-y-4 border-l-2 border-divider'>
              <Input
                label='SQL Endpoint'
                name='sqlEndpoint'
                defaultValue={deployment?.sqlEndpoint || ''}
                note='The endpoint that can execute SQL queries.'
              />
              <Input
                label='Security Token'
                name='sqlToken'
                type='password'
                defaultValue={deployment?.sqlToken || ''}
                note='A token to secure your SQL endpoint.'
              />
            </div>
          )}
        </div>
        <div class='mt-6 flex justify-end gap-4'>
          <Button
            type='button'
            params={{ view: 'deployments', action: null, id: null }}
            variant='secondary'
            replace
          >
            Cancel
          </Button>
          <Button type='submit'>Save Deployment</Button>
        </div>
      </form>
    </Card>
  )
}

function DeploymentsList({ deployments }: { deployments: Deployment[] }) {
  const handleDelete = (_id: string) => {
  }

  return (
    <Card
      title='Deployments'
      description='Manage your project deployments.'
    >
      <div class='space-y-4'>
        {deployments.map((dep) => (
          <div
            key={dep.url}
            class='flex items-center justify-between p-4 rounded-md border border-divider'
          >
            <div>
              <p class='font-semibold'>{dep.url}</p>
              <p class='text-sm text-text-secondary'>
                Logs: {dep.logsEnabled ? 'Enabled' : 'Disabled'} | Database:
                {' '}
                {dep.databaseEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div class='flex gap-2'>
              <Button
                params={{
                  view: 'deployments',
                  action: 'edit',
                  id: dep.url,
                }}
                variant='secondary'
                replace
              >
                Edit
              </Button>
              <Button
                onClick={() => handleDelete(dep.url)}
                variant='danger'
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div class='mt-6 flex justify-end'>
        <Button
          params={{ view: 'deployments', action: 'add' }}
          replace
        >
          Add Deployment
        </Button>
      </div>
    </Card>
  )
}

function UserManagement() {
  const teamMembersDetails = team.data?.teamMembers.map((email) =>
    users.data?.find((u) => u.userEmail === email)
  ).filter(Boolean) as User[]

  const handleAddUser = (e: TargetedEvent<HTMLFormElement>) => {
    e.preventDefault()
  }

  const handleRemoveUser = (_email: string) => {
  }

  return (
    <Card
      title='User Management'
      description='Manage who has access to this project.'
    >
      <div class='space-y-4'>
        {teamMembersDetails.map((member) => (
          <div
            key={member.userEmail}
            class='flex items-center justify-between'
          >
            <div class='flex items-center gap-3'>
              <img
                src={member.userPicture ||
                  `https://ui-avatars.com/api/?name=${member.userFullName}&background=random`}
                alt={member.userFullName}
                class='w-10 h-10 rounded-full'
              />
              <div>
                <p class='font-semibold'>{member.userFullName}</p>
                <p class='text-sm text-text-secondary'>
                  {member.userEmail}
                </p>
              </div>
            </div>
            <Button
              onClick={() => handleRemoveUser(member.userEmail)}
              variant='danger'
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <div class='mt-6 pt-6 border-t border-divider'>
        <h4 class='text-md font-semibold mb-2'>Add a new user</h4>
        <form class='flex gap-2' onSubmit={handleAddUser}>
          <Input
            name='newUserEmail'
            label='User Email'
            placeholder='user@example.com'
          />
          <div class='self-end'>
            <Button type='submit'>Add User</Button>
          </div>
        </form>
      </div>
    </Card>
  )
}

export const SettingsPage = () => {
  if (!user.data?.isAdmin) {
    navigate({ params: { nav: 'deployments' } })
  }
  const { view = 'info', action, id } = url.params
  if (!project.data) return null

  team.fetch({ teamId: project.data!.teamId })

  const content = view === 'deployments'
    ? (
      action === 'add'
        ? <DeploymentForm />
        : action === 'edit' && id
        ? (
          <DeploymentForm
            deployment={deployments.data?.find((d) => d.url === id)}
          />
        )
        : <DeploymentsList deployments={deployments.data ?? []} />
    )
    : view === 'users'
    ? <UserManagement />
    : <ProjectInfoForm />

  return (
    <>
      <PageHeader class='gap-4 bg-base-100'>
        <h1 class='text-xl sm:text-2xl font-semibold text-text'>
          Project Settings: {project.data?.name}
        </h1>
        <div class='flex gap-2'>
          <Button
            params={{ view: 'info' }}
            variant={view === 'info' ? 'primary' : 'secondary'}
            replace
          >
            Info
          </Button>
          <Button
            params={{ view: 'deployments' }}
            variant={view === 'deployments' ? 'primary' : 'secondary'}
            replace
          >
            Deployments
          </Button>
          <Button
            params={{ view: 'users' }}
            variant={view === 'users' ? 'primary' : 'secondary'}
            replace
          >
            Users
          </Button>
        </div>
      </PageHeader>
      <PageContent>
        <div class='space-y-6'>
          {content}
        </div>
      </PageContent>
    </>
  )
}
