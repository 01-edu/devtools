import { effect } from '@preact/signals'
import { A, navigate, url } from '@01edu/signal-router'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
} from 'lucide-preact'
import type { ComponentChildren } from 'preact'
import { api, ApiOutput } from '../../lib/api.ts'
import { project, projectTeam, tasks } from '../../lib/shared.tsx'
import { Dialog, DialogModal } from '../../components/Dialog.tsx'
import { DeploymentHeader } from '../../components/DeploymentHeader.tsx'
import { Toast, toast } from '../../components/Toast.tsx'
import { parseSort } from '../../components/Filtre.tsx'

type Task = ApiOutput['GET/api/project/tasks'][number]
type Status = Task['status']
type Priority = Task['priority']

const statuses: {
  key: Status
  label: string
  dot: string
  lozenge: string
}[] = [
  {
    key: 'todo',
    label: 'To do',
    dot: 'bg-base-content/30',
    lozenge: 'bg-base-200 text-base-content/70',
  },
  {
    key: 'in_progress',
    label: 'In progress',
    dot: 'bg-warning',
    lozenge: 'bg-warning/15 text-warning',
  },
  {
    key: 'done',
    label: 'Done',
    dot: 'bg-success',
    lozenge: 'bg-success/15 text-success',
  },
]

const statusOrder: Record<Status, number> = {
  todo: 0,
  in_progress: 1,
  done: 2,
}

const priorityOrder: Record<Priority, number> = { low: 0, medium: 1, high: 2 }

const priorityConfig: Record<
  Priority,
  { label: string; short: string; badge: string }
> = {
  low: { label: 'Low priority', short: 'Low', badge: 'bg-info/10 text-info' },
  medium: {
    label: 'Medium priority',
    short: 'Medium',
    badge: 'bg-warning/10 text-warning',
  },
  high: {
    label: 'High priority',
    short: 'High',
    badge: 'bg-error/10 text-error',
  },
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join('')
    .toUpperCase()

const teamMember = (id: string) =>
  projectTeam.data?.members.find((m) => m.id === id)

const refreshTasks = () => {
  const slug = project.data?.slug
  if (slug) tasks.fetch({ project: slug })
}

const patchTask = (id: string, changes: {
  title?: string
  status?: Status
  priority?: Priority
  description?: string
  assigneeIds?: string[]
  position?: number
}) =>
  api['PUT/api/task'].fetch({
    id,
    title: undefined,
    status: undefined,
    priority: undefined,
    description: undefined,
    assigneeIds: undefined,
    position: undefined,
    ...changes,
  })

const tasksInStatus = (status: Status, excludeId?: string) =>
  (tasks.data || [])
    .filter((t) => t.status === status && t.id !== excludeId)
    .sort((a, b) => a.position - b.position)

const endPosition = (status: Status, excludeId?: string) => {
  const group = tasksInStatus(status, excludeId)
  return group.length ? group[group.length - 1].position + 1000 : Date.now()
}

async function saveTask(
  input: {
    id?: string
    title: string
    description?: string
    priority: Priority
    assigneeIds: string[]
    status: Status
    previousStatus?: Status
  },
) {
  const slug = project.data?.slug
  if (!slug) return
  try {
    if (input.id) {
      const statusChanged = input.previousStatus !== undefined &&
        input.previousStatus !== input.status
      await patchTask(input.id, {
        title: input.title,
        description: input.description,
        priority: input.priority,
        assigneeIds: input.assigneeIds,
        status: input.status,
        position: statusChanged
          ? endPosition(input.status, input.id)
          : undefined,
      })
    } else {
      const created = await api['POST/api/task'].fetch({
        projectSlug: slug,
        title: input.title,
        description: input.description,
        priority: input.priority,
        assigneeIds: input.assigneeIds,
      })
      if (input.status !== created.status) {
        await patchTask(created.id, {
          status: input.status,
          position: endPosition(input.status, created.id),
        })
      }
    }
    refreshTasks()
    navigate({
      params: { dialog: null, taskId: null, status: null },
      replace: true,
    })
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), 'error')
  }
}

async function deleteTasks(ids: string[]) {
  try {
    await Promise.all(ids.map((id) => api['DELETE/api/task'].fetch({ id })))
    const remaining = selectedIds().filter((id) => !ids.includes(id))
    refreshTasks()
    navigate({
      params: {
        dialog: null,
        taskId: null,
        confirm: null,
        sel: remaining.join(',') || null,
      },
      replace: true,
    })
    toast(ids.length > 1 ? `${ids.length} tasks deleted.` : 'Task deleted.')
  } catch (err) {
    navigate({ params: { confirm: null }, replace: true })
    toast(err instanceof Error ? err.message : String(err), 'error')
  }
}

async function changeStatus(task: Task, status: Status) {
  if (status === task.status) return
  try {
    await patchTask(task.id, { status, position: endPosition(status, task.id) })
    refreshTasks()
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), 'error')
  }
}

const selectedIds = () => (url.params.sel || '').split(',').filter(Boolean)

const setSelection = (ids: string[]) =>
  navigate({ params: { sel: ids.join(',') || null }, replace: true })

type SortKey = 'title' | 'priority' | 'status' | 'number'

const comparators: Record<SortKey, (a: Task, b: Task) => number> = {
  title: (a, b) => a.title.localeCompare(b.title),
  priority: (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  status: (a, b) => statusOrder[a.status] - statusOrder[b.status],
  number: (a, b) => a.number - b.number,
}

const taskSort = () => parseSort('tk')[0]

const sortTasks = (list: Task[]) => {
  const { key, dir } = taskSort()
  if (!(key in comparators)) {
    return [...list].sort((a, b) =>
      statusOrder[a.status] - statusOrder[b.status] || a.position - b.position
    )
  }
  const mul = dir === 'desc' ? -1 : 1
  return [...list].sort((a, b) => comparators[key as SortKey](a, b) * mul)
}

let deleting = false
effect(() => {
  const { dialog, taskId, confirm } = url.params
  if (dialog !== 'delete-task' || !taskId || confirm !== '1' || deleting) return
  deleting = true
  deleteTasks(taskId.split(',')).finally(() => (deleting = false))
})

const Avatar = ({ name, class: cls }: { name: string; class: string }) => (
  <span class={`flex shrink-0 items-center justify-center rounded-full ${cls}`}>
    {initials(name)}
  </span>
)

const avatarStyle = 'h-6 w-6 bg-primary/15 text-[10px] font-medium text-primary'

const AssigneeAvatar = ({ id }: { id: string }) => {
  const name = teamMember(id)?.name || id
  return (
    <div class='tooltip' data-tip={name}>
      <Avatar name={name} class={`${avatarStyle} ring-2 ring-base-100`} />
    </div>
  )
}

const SelectCheckbox = (
  { label, checked, onChange }: {
    label: string
    checked: boolean
    onChange: () => void
  },
) => (
  <input
    type='checkbox'
    class='checkbox checkbox-xs align-middle'
    aria-label={label}
    checked={checked}
    onChange={onChange}
  />
)

const NewTaskLink = (
  { class: cls, children }: { class: string; children: ComponentChildren },
) => (
  <A params={{ dialog: 'task-form', taskId: null, status: 'todo' }} class={cls}>
    <Plus class='w-4 h-4' />
    {children}
  </A>
)

const StatusOptions = () =>
  statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const p = priorityConfig[priority]
  return (
    <span
      title={p.label}
      class={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${p.badge}`}
    >
      <span class='h-1.5 w-1.5 rounded-full bg-current' />
      {p.short}
    </span>
  )
}

const StatusLozenge = ({ task }: { task: Task }) => {
  const status = statuses.find((s) => s.key === task.status) ?? statuses[0]
  return (
    <select
      value={task.status}
      onChange={(e) =>
        changeStatus(task, (e.target as HTMLSelectElement).value as Status)}
      class={`select select-xs w-28 rounded-full border-0 font-medium focus:outline-none ${status.lozenge}`}
    >
      <StatusOptions />
    </select>
  )
}

const thBase =
  'py-2.5 pr-2 text-left text-xs font-medium text-base-content/50 bg-base-100'

const SortableTh = (
  { label, k, class: cls = '' }: {
    label: string
    k: SortKey
    class?: string
  },
) => {
  const sort = taskSort()
  const active = sort.key === k
  const asc = active && sort.dir === 'asc'
  return (
    <th class={`${thBase} ${cls}`}>
      <A
        params={{ stk: `${k},${asc ? 'desc' : 'asc'}` }}
        class={`flex items-center gap-1 transition-colors hover:text-base-content hover:no-underline ${
          active ? 'text-base-content' : ''
        }`}
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        {active &&
          (asc ? <ArrowUp class='w-3 h-3' /> : <ArrowDown class='w-3 h-3' />)}
      </A>
    </th>
  )
}

const TaskRow = ({ task }: { task: Task }) => {
  const selected = selectedIds()
  const isSelected = selected.includes(task.id)
  const toggle = () =>
    setSelection(
      isSelected
        ? selected.filter((id) => id !== task.id)
        : [...selected, task.id],
    )

  return (
    <tr
      class={`group border-t border-base-300/50 transition-colors ${
        isSelected ? 'bg-primary/5' : 'hover:bg-base-200/40'
      }`}
    >
      <td class='py-2 pl-3 pr-1'>
        <SelectCheckbox
          label={`Select task #${task.number}`}
          checked={isSelected}
          onChange={toggle}
        />
      </td>
      <td class='py-2 pr-2'>
        <A
          params={{ dialog: 'task-form', taskId: task.id }}
          class='hover:no-underline'
        >
          <span class='block truncate text-sm font-medium text-base-content'>
            {task.title}
          </span>
        </A>
      </td>
      <td class='hidden lg:table-cell py-2 pr-2'>
        <span class='block truncate text-xs text-base-content/50'>
          {task.description || '—'}
        </span>
      </td>
      <td class='py-2 pr-2'>
        {task.assigneeIds.length > 0
          ? (
            <div class='flex -space-x-1.5'>
              {task.assigneeIds.slice(0, 3).map((id) => (
                <AssigneeAvatar key={id} id={id} />
              ))}
            </div>
          )
          : <span class='text-xs text-base-content/30'>—</span>}
      </td>
      <td class='py-2 pr-2'>
        <PriorityBadge priority={task.priority} />
      </td>
      <td class='py-2 pr-2'>
        <StatusLozenge task={task} />
      </td>
      <td class='hidden sm:table-cell py-2 pr-2 font-mono text-[10px] text-base-content/40'>
        #{task.number}
      </td>
      <td class='py-2 pr-3'>
        <A
          params={{ dialog: 'delete-task', taskId: task.id }}
          class='btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100 transition-opacity'
          title='Delete task'
        >
          <Trash2 class='w-3.5 h-3.5 text-error' />
        </A>
      </td>
    </tr>
  )
}

const TaskTable = ({ rows }: { rows: Task[] }) => {
  const selected = selectedIds()
  const allSelected = rows.length > 0 &&
    rows.every((t) => selected.includes(t.id))
  const toggleAll = () => setSelection(allSelected ? [] : rows.map((t) => t.id))

  return (
    <div class='min-h-0 flex-1 overflow-auto rounded-xl border border-base-300 bg-base-100'>
      <table class='w-full table-fixed'>
        <thead class='sticky top-0 z-10'>
          <tr class='shadow-[0_1px_0_0] shadow-base-300/60'>
            <th class={`${thBase} w-10 pl-3 pr-1`}>
              <SelectCheckbox
                label='Select all tasks'
                checked={allSelected}
                onChange={toggleAll}
              />
            </th>
            <SortableTh label='Task Name' k='title' />
            <th class={`${thBase} hidden lg:table-cell`}>Description</th>
            <th class={`${thBase} w-20`}>People</th>
            <SortableTh label='Priority' k='priority' class='w-24' />
            <SortableTh label='Status' k='status' class='w-32' />
            <SortableTh
              label='#'
              k='number'
              class='w-14 hidden sm:table-cell'
            />
            <th class={`${thBase} w-10 pr-3`} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? (
              <tr>
                <td
                  colSpan={8}
                  class='border-t border-base-300/50 py-8 text-center text-xs text-base-content/40'
                >
                  No matching tasks
                </td>
              </tr>
            )
            : rows.map((task) => <TaskRow key={task.id} task={task} />)}
          <tr class='border-t border-base-300/50'>
            <td colSpan={8} class='p-0'>
              <NewTaskLink class='flex w-full items-center gap-2 px-3 py-2.5 text-sm text-base-content/50 transition-colors hover:bg-base-200/40 hover:text-base-content hover:no-underline'>
                New task
              </NewTaskLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

const SelectionBar = () => {
  const selected = selectedIds()
  if (selected.length === 0) return null
  return (
    <div class='mb-3 flex items-center gap-3 rounded-lg border border-base-300 bg-base-100 px-3 py-2'>
      <span class='text-sm font-medium'>
        {selected.length} selected
      </span>
      <span class='flex-1' />
      <A params={{ sel: null }} class='btn btn-ghost btn-sm'>
        Clear
      </A>
      <A
        params={{ dialog: 'delete-task', taskId: selected.join(',') }}
        class='btn btn-error btn-sm'
      >
        <Trash2 class='w-4 h-4' />
        Delete
      </A>
    </div>
  )
}

const AssigneeChip = ({ id, checked }: { id: string; checked: boolean }) => {
  const name = teamMember(id)?.name || id
  return (
    <label class='flex cursor-pointer items-center gap-1.5 rounded-full border border-base-300 px-2 py-1 text-xs text-base-content/70 transition-colors hover:border-base-content/30 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary'>
      <input
        type='checkbox'
        name='assignees'
        value={id}
        defaultChecked={checked}
        class='hidden'
      />
      <Avatar
        name={name}
        class='h-4.5 w-4.5 bg-base-200 text-[8px] font-semibold'
      />
      {name}
    </label>
  )
}

const TaskForm = ({ task }: { task?: Task }) => {
  const members = projectTeam.data?.members || []

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const data = new FormData(e.target as HTMLFormElement)
    const title = (data.get('title') as string || '').trim()
    if (!title) return
    saveTask({
      id: task?.id,
      title,
      description: (data.get('description') as string) || undefined,
      priority: (data.get('priority') as Priority) || 'medium',
      assigneeIds: data.getAll('assignees').map(String),
      status: (data.get('status') as Status) || 'todo',
      previousStatus: task?.status,
    })
  }

  return (
    <form onSubmit={handleSubmit} class='w-full space-y-4 sm:w-96'>
      <h3 class='text-lg font-semibold'>
        {task ? `Edit task #${task.number}` : 'New task'}
      </h3>
      <label class='form-control w-full'>
        <span class='label label-text text-sm'>Title</span>
        <input
          type='text'
          name='title'
          required
          defaultValue={task?.title || ''}
          placeholder='What needs to be done?'
          class='input input-bordered w-full'
          autofocus
        />
      </label>
      <label class='form-control w-full'>
        <span class='label label-text text-sm'>Description</span>
        <textarea
          name='description'
          rows={4}
          defaultValue={task?.description || ''}
          class='textarea textarea-bordered w-full'
        />
      </label>
      <div class='flex gap-4'>
        <label class='form-control w-full'>
          <span class='label label-text text-sm'>Status</span>
          <select
            name='status'
            defaultValue={task?.status || (url.params.status as Status) ||
              'todo'}
            class='select select-bordered w-full'
          >
            <StatusOptions />
          </select>
        </label>
        <label class='form-control w-full'>
          <span class='label label-text text-sm'>Priority</span>
          <select
            name='priority'
            defaultValue={task?.priority || 'medium'}
            class='select select-bordered w-full'
          >
            {(['low', 'medium', 'high'] as const).map((p) => (
              <option key={p} value={p}>{priorityConfig[p].short}</option>
            ))}
          </select>
        </label>
      </div>
      {members.length > 0 && (
        <div>
          <span class='label label-text text-sm'>Assignees</span>
          <div class='flex flex-wrap gap-1.5'>
            {members.map((m) => (
              <AssigneeChip
                key={m.id}
                id={m.id}
                checked={(task?.assigneeIds || []).includes(m.id)}
              />
            ))}
          </div>
        </div>
      )}
      <div class='modal-action justify-between'>
        {task
          ? (
            <A
              params={{ dialog: 'delete-task', taskId: task.id }}
              class='btn btn-ghost btn-sm text-error'
            >
              <Trash2 class='w-4 h-4' />
              Delete
            </A>
          )
          : <span />}
        <div class='flex gap-2'>
          <A
            class='btn btn-ghost'
            params={{ dialog: null, taskId: null, status: null }}
          >
            Cancel
          </A>
          <button type='submit' class='btn btn-primary'>Save</button>
        </div>
      </div>
    </form>
  )
}

function TaskFormDialog() {
  const { dialog, taskId } = url.params
  if (dialog !== 'task-form') return null
  const task = taskId ? tasks.data?.find((t) => t.id === taskId) : undefined

  return (
    <DialogModal id='task-form'>
      <TaskForm key={task?.id || 'new'} task={task} />
    </DialogModal>
  )
}

function ConfirmDeleteDialog() {
  const { dialog, taskId } = url.params
  if (dialog !== 'delete-task' || !taskId) return null
  const ids = taskId.split(',')
  const single = ids.length === 1
    ? tasks.data?.find((t) => t.id === ids[0])
    : undefined
  if (ids.length === 1 && !single) return null

  return (
    <Dialog id='delete-task' class='modal'>
      <div class='modal-box w-auto'>
        <div class='flex items-start gap-3'>
          <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/10'>
            <Trash2 class='w-5 h-5 text-error' />
          </div>
          <div>
            <h3 class='text-lg font-semibold'>
              {single ? 'Delete task' : `Delete ${ids.length} tasks`}
            </h3>
            <p class='mt-1 text-sm text-base-content/70'>
              Are you sure you want to delete {single
                ? <span class='font-medium'>"{single.title}"</span>
                : `${ids.length} tasks`}? This cannot be undone.
            </p>
          </div>
        </div>
        <div class='modal-action'>
          <A class='btn btn-ghost' params={{ dialog: null, taskId: null }}>
            Cancel
          </A>
          <A class='btn btn-error' params={{ confirm: '1' }}>
            Delete
          </A>
        </div>
      </div>
    </Dialog>
  )
}

const TaskListHeader = () => (
  <DeploymentHeader>
    <div class='flex items-center gap-2'>
      <label class='input input-sm w-40 sm:w-64'>
        <Search class='opacity-50 w-4 h-4' />
        <input
          type='search'
          class='grow'
          placeholder='Search tasks'
          value={url.params.tq || ''}
          onInput={(e) =>
            navigate({
              params: { tq: (e.target as HTMLInputElement).value || null },
              replace: true,
            })}
        />
      </label>
      <NewTaskLink class='btn btn-primary btn-sm'>
        <span class='hidden sm:inline'>New task</span>
      </NewTaskLink>
    </div>
  </DeploymentHeader>
)

const EmptyState = () => (
  <div class='flex flex-col items-center justify-center py-20 text-center'>
    <div class='mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-base-200'>
      <CheckCircle2 class='w-7 h-7 text-base-content/30' />
    </div>
    <p class='text-sm font-medium text-base-content/70'>No tasks yet</p>
    <p class='mt-1 text-xs text-base-content/50'>
      Create a task to start planning your work.
    </p>
    <NewTaskLink class='btn btn-primary btn-sm mt-4'>
      Create the first task
    </NewTaskLink>
  </div>
)

export const TasksPage = () => {
  const q = url.params.tq?.toLowerCase() ?? ''
  const allTasks = tasks.data || []
  const filtered = q
    ? allTasks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    )
    : allTasks
  const rows = sortTasks(filtered)

  return (
    <div class='h-full flex flex-col min-h-0 bg-base-200'>
      <TaskListHeader />
      <div class='flex-1 min-h-0 px-4 sm:px-6 py-5'>
        {tasks.pending && !tasks.data
          ? (
            <div class='flex justify-center py-12'>
              <span class='loading loading-spinner loading-md' />
            </div>
          )
          : allTasks.length === 0
          ? <EmptyState />
          : (
            <div class='mx-auto flex h-full max-w-6xl flex-col'>
              <SelectionBar />
              <TaskTable rows={rows} />
            </div>
          )}
      </div>
      <TaskFormDialog />
      <ConfirmDeleteDialog />
      <Toast />
    </div>
  )
}
