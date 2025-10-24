import { ChevronRight, Clock, Play, Search, Trash2 } from 'lucide-preact'
import { A } from '../lib/router.tsx'

interface QueryHistoryItem {
  query: string
  timestamp: string
  columns?: number
  rows?: number
}

const deleteQuery = (_hash: string) => {
  // TODO: implement delete functionality
}

export function QueryHistory({
  onRunQuery,
}: {
  onRunQuery?: (query: string) => void
}) {
  const filteredHistory = [
    {
      query: 'SELECT * FROM users;',
      timestamp: '2024-06-01T12:00:00Z',
      columns: 5,
      rows: 100,
    },
    {
      query: 'SELECT id, name FROM products WHERE price > 100;',
      timestamp: '2024-06-02T15:30:00Z',
      columns: 2,
      rows: 50,
    },
    {
      query: 'UPDATE orders SET status = "shipped" WHERE id = 123;',
      timestamp: '2024-06-03T09:45:00Z',
      columns: 1,
      rows: 1,
    },
  ]

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
        {filteredHistory.map((item, index) => (
          <div
            key={index}
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
                  onClick={() =>
                    onRunQuery ? onRunQuery(item.query) : undefined}
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
                  onClick={() => deleteQuery(item.timestamp)}
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
