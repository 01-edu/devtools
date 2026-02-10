import { effect } from '@preact/signals'
import { api } from '../lib/api.ts'
import {
  Code,
  Database,
  Loader2,
  Plus,
  Terminal,
  Trash,
  X,
} from 'lucide-preact'
import { DialogModal } from '../components/Dialog.tsx'
import { A, navigate, url } from '@01edu/signal-router'
import type { SQLTool } from '../../api/schema.ts'
import { project } from '../lib/shared.tsx'
import { TargetedEvent } from 'preact'

const tools = api['GET/api/project/tools'].signal()
const createTool = api['POST/api/project/tool'].signal()
const deleteTool = api['DELETE/api/project/tool'].signal()

effect(() => {
  const { data } = project
  if (!data?.slug) return
  tools.fetch({ project: data.slug })
})

const PageHeader = (
  { title, desc, actions }: {
    title: string
    desc: string
    actions?: preact.ComponentChildren
  },
) => (
  <div class='border-b border-base-300 bg-base-100 px-8 py-6 flex items-center justify-between gap-4'>
    <div>
      <h1 class='text-xl font-semibold text-base-content'>{title}</h1>
      <p class='text-sm text-base-content/60 mt-1'>{desc}</p>
    </div>
    {actions}
    {createTool.error || deleteTool.error ||
      tools.error && (
          <div class='alert alert-error text-sm absolute top-4 right-4 w-auto shadow-lg'>
            <X class='w-4 h-4' />
            <span>{createTool.error || deleteTool.error || tools.error}</span>
          </div>
        )}
  </div>
)

const ToolCard = ({ tool }: { tool: SQLTool }) => {
  const onDelete = () => {
    if (!project.data?.slug) return
    deleteTool.fetch({ id: tool.toolId })
    if (!deleteTool.error) {
      tools.fetch({ project: project.data.slug })
    }
  }
  return (
    <div class='p-4 hover:bg-base-100 transition-colors flex items-start justify-between group border-b border-base-300 last:border-b-0'>
      <div class='space-y-2 w-full'>
        <div class='flex items-center gap-3'>
          <span class='font-semibold text-sm'>{tool.name}</span>
          <div class='flex gap-1'>
            <span
              class={`badge badge-xs ${
                tool.enabled ? 'badge-success' : 'badge-ghost'
              } font-mono uppercase tracking-wider text-[10px]`}
            >
              {tool.enabled ? 'Active' : 'Disabled'}
            </span>
            <span class='badge badge-xs badge-outline font-mono uppercase tracking-wider text-[10px]'>
              {tool.triggerEvent}
            </span>
          </div>
        </div>
        <div class='flex gap-4 text-xs text-base-content/60'>
          <div class='flex gap-1 items-center'>
            <span class='font-semibold text-base-content/40'>TABLES</span>
            <span class='font-mono bg-base-300 px-1.5 py-0.5 rounded'>
              {tool.targetTables.join(', ')}
            </span>
          </div>
          <div class='flex gap-1 items-center'>
            <span class='font-semibold text-base-content/40'>COLUMNS</span>
            <span class='font-mono bg-base-300 px-1.5 py-0.5 rounded'>
              {tool.targetColumns.join(', ')}
            </span>
          </div>
        </div>
        <div class='relative group/code'>
          <pre class='text-[10px] sm:text-xs bg-base-300/50 p-3 rounded-md border border-base-content/5 font-mono text-base-content/70 max-h-32 overflow-hidden group-hover/code:max-h-full group-hover/code:overflow-auto transition-all duration-300'>
          {tool.code}
          </pre>
          <div class='absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-base-300/50 to-transparent pointer-events-none group-hover/code:hidden'>
          </div>
        </div>
      </div>
      <div class='pl-4'>
        <button
          type='button'
          class='btn btn-ghost btn-square btn-sm text-error opacity-0 group-hover:opacity-100 transition-opacity'
          onClick={onDelete}
          title='Delete Tool'
        >
          <Trash class='w-4 h-4' />
        </button>
      </div>
    </div>
  )
}

const ToolList = () => (
  <div class='bg-base-200 rounded-lg border border-base-300 overflow-hidden shadow-sm'>
    <div class='px-4 py-3 border-b border-base-300 flex justify-between items-center bg-base-200/50'>
      <h3 class='font-semibold text-sm tracking-wide text-base-content/80'>
        Configured Tools ({tools.data?.length})
      </h3>
    </div>
    {tools.data?.length === 0
      ? (
        <div class='p-12 text-center text-base-content/40 text-sm flex flex-col items-center gap-2'>
          <Terminal class='w-8 h-8 opacity-50' />
          <p>No tools configured.</p>
          <A params={{ dialog: 'create-tool' }} class='link link-primary'>
            Create your first tool
          </A>
        </div>
      )
      : (
        <div>
          {tools.data?.map((tool) => (
            <ToolCard
              key={tool.toolId}
              tool={tool}
            />
          ))}
        </div>
      )}
  </div>
)

const onSubmit = async (e: TargetedEvent<HTMLFormElement>) => {
  e.preventDefault()
  if (!project.data?.slug) return

  const form = e.currentTarget
  const formData = new FormData(form)
  const name = formData.get('name') as string
  const triggerEvent = formData.get('triggerEvent') as 'BEFORE' | 'AFTER'
  const targetTables = (formData.get('targetTables') as string).split(',').map(s => s.trim()).filter(Boolean)
  const targetColumns = (formData.get('targetColumns') as string).split(',').map(s => s.trim()).filter(Boolean)
  const code = formData.get('code') as string
  const enabled = formData.get('enabled') === 'on'
  
  await createTool.fetch({
    projectId: project.data.slug, 
    name, 
    triggerEvent, 
    targetTables, 
    targetColumns, 
    code, 
    enabled
  })
  
  if (!createTool.error) {
    navigate({params: {dialog: null}})
    tools.fetch({project: project.data.slug})
  }
}

const CreateToolModal = () => (
    <DialogModal id='create-tool' boxClass='w-11/12 max-w-5xl'>
      <div class='flex flex-col h-[85vh]'>
        <div class='px-6 pt-6 flex-none'>
          <h3 class='text-lg font-bold flex items-center gap-2'>
            <Terminal class='w-5 h-5' />
            Create SQL Tool
          </h3>
        </div>

        <form
          id='create-tool-form'
          onSubmit={onSubmit}
          class='flex-1 overflow-y-auto px-6 py-4'
        >
          <div class='grid grid-cols-1 md:grid-cols-2 gap-6 h-full'>
            <div class='space-y-4'>
              <div class='form-control w-full'>
                <label class='label'>
                  <span class='label-text font-medium'>Tool Name</span>
                </label>
                <input
                  type='text'
                  name='name'
                  class='input input-bordered w-full'
                  required
                  placeholder='e.g. Encrypt Passwords'
                />
              </div>

              <div class='form-control w-full'>
                <label class='label'>
                  <span class='label-text font-medium'>Trigger Event</span>
                </label>
                <select name='triggerEvent' class='select select-bordered w-full'>
                  <option value='BEFORE'>BEFORE (Write - Modify Params)</option>
                  <option value='AFTER'>AFTER (Read - Transform Rows)</option>
                </select>
              </div>

              <div class='form-control w-full'>
                <label class='label'>
                  <span class='label-text font-medium'>Target Tables</span>
                </label>
                <input
                  type='text'
                  name='targetTables'
                  class='input input-bordered w-full'
                  required
                  placeholder='users, *'
                />
              </div>

              <div class='form-control w-full'>
                <label class='label'>
                  <span class='label-text font-medium'>Target Columns</span>
                </label>
                <input
                  type='text'
                  name='targetColumns'
                  class='input input-bordered w-full'
                  required
                  placeholder='password, *'
                />
              </div>

              <div class='form-control'>
                <label class='label cursor-pointer justify-start gap-3 p-0 pt-2'>
                  <input
                    type='checkbox'
                    name='enabled'
                    class='toggle toggle-primary'
                  />
                  <span class='label-text font-medium'>Enable Tool</span>
                </label>
              </div>
            </div>

            <div class='form-control h-full flex flex-col'>
              <label class='label'>
                <span class='label-text font-medium flex items-center gap-2'>
                  <Code class='w-4 h-4' /> JavaScript Logic
                </span>
              </label>
              <textarea
                name='code'
                class='textarea textarea-bordered font-mono text-xs leading-relaxed flex-1 bg-neutral text-neutral-content w-full resize-none p-4'
                required
                spellcheck={false}
              >
              </textarea>
            </div>
          </div>
        </form>

        <div class='modal-action px-6 pb-6 mt-0 flex-none'>
          <A params={{ dialog: null }} class='btn btn-ghost'>Cancel</A>
          <button
            type='submit'
            form='create-tool-form'
            class='btn btn-primary min-w-[120px]'
            disabled={!!createTool.pending}
          >
            {createTool.pending
              ? <Loader2 class='w-4 h-4 animate-spin' />
              : 'Create Tool'}
          </button>
        </div>
      </div>
    </DialogModal>
  )

const ToolsSidebar = () => {
  const activeTab = url.params.tab 
  if (!activeTab) {
    navigate({ params: { tab: 'sql' }, replace: true })
    return null
  }
  return (
    <aside class='w-64 h-[calc(100vh-64px)] bg-base-200 border-r border-base-300 flex flex-col flex-none'>
      <div class='p-4 border-b border-base-300'>
        <h2 class='text-sm font-semibold text-base-content/60 uppercase tracking-wider'>
          Reference
        </h2>
      </div>
      <nav class='flex-1 p-2 overflow-y-auto'>
        <ul class='space-y-1'>
          <li>
            <A
              params={{ tab: 'sql' }}
              replace
              class={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                activeTab === 'sql'
                  ? 'bg-primary text-primary-content shadow-sm'
                  : 'hover:bg-base-300 text-base-content'
              }`}
            >
              <Database class='w-4 h-4' />
              <span class='font-medium'>SQL Tools</span>
            </A>
          </li>
        </ul>
      </nav>
    </aside>
  )
}

export function ToolsPage() {
  return (
    <div class='flex h-full overflow-hidden bg-base-100'>
      <ToolsSidebar />
      <div class='flex-1 flex flex-col h-full min-h-0 bg-base-100 relative'>
        <PageHeader
          title='SQL Tools'
          desc='Manage database tooling scripts for data transformation and validation.'
          actions={
            <A
              params={{ dialog: 'create-tool' }}
              class='btn btn-sm btn-primary gap-1 shadow-sm'
            >
              <Plus class='w-4 h-4' /> New Tool
            </A>
          }
        />

        <div class='flex-1 overflow-y-auto p-8 min-h-0'>
          <div class='max-w-4xl mx-auto space-y-6'>
            {tools.pending && tools.data?.length === 0
              ? (
                <div class='flex justify-center p-8'>
                  <Loader2 class='w-8 h-8 animate-spin text-primary' />
                </div>
              )
              : <ToolList />}
          </div>
        </div>

        <CreateToolModal />
      </div>
    </div>
  )
}
