import { ChevronRight, Clock, Play, Search, Trash2 } from 'lucide-preact'
import { A } from '../lib/router.tsx'
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
  )

  return (
    <div class='flex flex-col h-full'>
      <div class='p-4 border-b border-base-300'>
        <h2 class='text-lg font-semibold'>Query History</h2>
        <div class='relative mt-2'>
          <Search class='absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50' />
          <input
            type='text'
            placeholder='Search history'
            class='input input-sm w-full pl-8'
          />
        </div>
      </div>
      <div class='flex-1 overflow-y-auto'>
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
                <button
                  type='button'
                  class='btn btn-xs btn-ghost'
                  title='Run query'
                  onClick={() => onRun(item.query)}
                >
                  <Play class='w-4 h-4' />
                </button>
                <A
                  class='btn btn-xs btn-ghost'
                  title='Insert into editor'
                  params={{ q: item.query }}
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
