import { ChevronRight, Clock, Play, Search, Trash2 } from 'lucide-preact'
import { A, navigate, url } from '../lib/router.tsx'
import { onRun, queriesHistory } from '../pages/DeploymentPage.tsx'

export type QueryHistoryItem = {
  query: string
  timestamp: string
  columns?: number
  rows?: number
}

const deleteQuery = (hash: string) => {
  const updatedHistory = { ...queriesHistory.value }
  delete updatedHistory[hash]
  queriesHistory.value = updatedHistory
}

export const QueryHistory = () => {
  const filteredHistory = Object.entries(queriesHistory.value).sort((a, b) =>
    new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime()
  ).filter(([_, item]) => {
    const qh = url.params.qh?.toLowerCase() || ''
    return item.query.toLowerCase().includes(qh)
  })

  return (
    <div class='flex flex-col h-full'>
      <div class='p-4 border-b border-base-300'>
        <h2 class='text-lg font-semibold'>Query History</h2>
        <div class='flex items-center justify-between mt-4 gap-2'>
          <label class='input input-sm min-w-0 w-full sm:w-64'>
            <Search class='opacity-50' />
            <input
              type='search'
              class='grow'
              placeholder='Search'
              value={url.params.qh || ''}
              onInput={(e) => {
                const value = (e.target as HTMLInputElement).value
                navigate({ params: { qh: value || null }, replace: true })
              }}
            />
          </label>
          <button
            type='button'
            class='btn btn-xs  btn-ghost text-error'
            title='Delete All from history'
            disabled={Object.keys(queriesHistory.value).length === 0}
            onClick={() => queriesHistory.value = {}}
          >
            <Trash2 class='w-4 h-4' />
            Clear All
          </button>
        </div>
      </div>
      <div class='flex-1  overflow-auto'>
        {filteredHistory.map(([hash, item]) => (
          <div
            key={hash}
            class='p-4 border-b border-base-300 hover:bg-base-200'
          >
            <div class='flex items-center justify-between'>
              <div class='flex-1 min-w-0'>
                <div class='text-xs text-base-content/60 flex items-center gap-2'>
                  <Clock class='w-3 h-3' />
                  {new Date(item.timestamp).toLocaleString()}
                </div>
                <p class='font-mono text-sm truncate mt-1' title={item.query}>
                  {item.query}
                </p>
                <div class='text-xs text-base-content/60 mt-1'>
                  {item.columns} columns, {item.rows} rows
                </div>
              </div>
              <div class='flex items-center gap-2 shrink-0 ml-4'>
                <A
                  params={{ q: item.query, tab: 'queries' }}
                  class='btn btn-xs btn-ghost'
                  title='Run query'
                  onClick={() => onRun(item.query)}
                >
                  <Play class='w-4 h-4' />
                </A>
                <A
                  class='btn btn-xs btn-ghost'
                  title='Insert into editor'
                  params={{ q: item.query, tab: 'queries' }}
                >
                  <ChevronRight class='w-4 h-4' />
                </A>
                <button
                  type='button'
                  class='btn btn-xs btn-ghost text-error'
                  title='Delete from history'
                  disabled={!deleteQuery}
                  onClick={() => deleteQuery(hash)}
                >
                  <Trash2 class='w-4 h-4' />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredHistory.length === 0 && (
          <div class='p-4 text-center text-base-content/60'>
            No queries found.
          </div>
        )}
      </div>
    </div>
  )
}
