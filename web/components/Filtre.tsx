import { ArrowUpDown, Filter, Plus } from 'lucide-preact'
import { A, navigate, url } from '../lib/router.tsx'

type FilterRow = { idx: number; key: string; op: string; value: string }

const filterOperators = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like'] as const

function parseFilters(prefix: string): FilterRow[] {
  const data = url.getAll(`f${prefix}`)
  const rows: FilterRow[] = []
  for (let i = 0; i < data.length; i++) {
    const str = data[i]
    const first = str.indexOf(',')
    const second = str.indexOf(',', first + 1)
    const key = str.slice(0, first)
    const op = str.slice(first + 1, second)
    const value = str.slice(second + 1)
    rows.push({ idx: i, key, op, value })
  }

  if (!rows.length) rows.push({ idx: 0, key: '', op: 'eq', value: '' })
  return rows
}

function setFilters(prefix: string, rows: FilterRow[]) {
  const next: string[] = []
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i]
    next.push([v.key, v.op, v.value].join(','))
  }
  navigate({ params: { [`f${prefix}`]: next }, replace: true })
}

function addFilter(prefix: string) {
  const rows = parseFilters(prefix)
  setFilters(prefix, [...rows, {
    idx: rows.length,
    key: '',
    op: 'eq',
    value: '',
  }])
}

function updateFilter(
  prefix: string,
  idx: number,
  patch: Partial<Pick<FilterRow, 'key' | 'op' | 'value'>>,
) {
  const rows = parseFilters(prefix)
  setFilters(prefix, rows.map((r) => (r.idx === idx ? { ...r, ...patch } : r)))
}

function removeFilter(prefix: string, idx: number) {
  const rows = parseFilters(prefix)
  setFilters(
    prefix,
    rows.filter((r) => r.idx !== idx),
  )
}

// --- Sort (URL) -------------------------------------------------------------
type SortRow = { idx: number; key: string; dir: 'asc' | 'desc' }

function parseSort(prefix: string): SortRow[] {
  const data = url.getAll(`s${prefix}`)
  const rows: SortRow[] = []
  for (let i = 0; i < data.length; i++) {
    const str = data[i]
    const first = str.indexOf(',')
    const key = str.slice(0, first)
    const dir = str.slice(first + 1) as 'asc' | 'desc'
    rows.push({ idx: i, key, dir })
  }
  if (!rows.length) rows.push({ idx: 0, key: '', dir: 'asc' })
  return rows
}

function setSort(prefix: string, rows: SortRow[]) {
  const next: string[] = []
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i]
    next.push([v.key, v.dir].join(','))
  }
  navigate({ params: { [`s${prefix}`]: next }, replace: true })
}

function addSort(prefix: string) {
  const rows = parseSort(prefix)
  setSort(prefix, [...rows, { idx: rows.length, key: '', dir: 'asc' }])
}

function updateSort(
  prefix: string,
  idx: number,
  patch: Partial<Pick<SortRow, 'key' | 'dir'>>,
) {
  const rows = parseSort(prefix)
  setSort(prefix, rows.map((r) => r.idx === idx ? { ...r, ...patch } : r))
}

function removeSort(prefix: string, idx: number) {
  const rows = parseSort(prefix)
  setSort(prefix, rows.filter((r) => r.idx !== idx))
}

// --- Components -------------------------------------------------------------

export const FilterMenu = (
  { filterKeyOptions, tag }: {
    filterKeyOptions: readonly string[]
    tag: 'tables' | 'logs'
  },
) => {
  const prefix = tag === 'tables' ? 't' : 'l'
  const rows = parseFilters(prefix)

  return (
    <details class='dropdown dropdown-end'>
      <summary class='btn btn-outline btn-sm'>
        <Filter class='h-4 w-4' />
        Filters
      </summary>
      <div class='dropdown-content z-10 w-110 mt-2'>
        <div class='bg-base-100 rounded-box shadow border border-base-300 p-3 space-y-3'>
          <div class='space-y-2 max-h-72 overflow-y-auto pr-1'>
            {rows.map((r) => (
              <div key={r.idx} class='flex items-center gap-2'>
                <select
                  class='select select-xs select-bordered w-32'
                  value={r.key}
                  onInput={(e) =>
                    updateFilter(prefix, r.idx, {
                      key: (e.target as HTMLSelectElement).value,
                    })}
                >
                  <option value=''>Key</option>
                  {filterKeyOptions.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>

                <select
                  class='select select-xs select-bordered w-20'
                  value={r.op}
                  onInput={(e) =>
                    updateFilter(prefix, r.idx, {
                      op: (e.target as HTMLSelectElement).value,
                    })}
                >
                  {filterOperators.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>

                <input
                  type='text'
                  class='input input-xs input-bordered flex-1'
                  placeholder='Value'
                  value={r.value}
                  onInput={(e) =>
                    updateFilter(prefix, r.idx, {
                      value: (e.target as HTMLInputElement).value,
                    })}
                />

                <button
                  type='button'
                  class='btn btn-xs btn-ghost'
                  onClick={() => removeFilter(prefix, r.idx)}
                  title='Remove'
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type='button'
            class='btn btn-outline btn-xs w-full'
            onClick={() => addFilter(prefix)}
          >
            <Plus class='h-3 w-3' />
            Add
          </button>
        </div>
      </div>
    </details>
  )
}

export const SortMenu = ({ tag, sortKeyOptions }: {
  tag: 'tables' | 'logs'
  sortKeyOptions: readonly string[]
}) => {
  const prefix = tag === 'tables' ? 't' : 'l'
  const rows = parseSort(prefix)
  return (
    <details class='dropdown dropdown-end'>
      <summary class='btn btn-outline btn-sm'>
        <ArrowUpDown class='h-4 w-4' />
        Sort
      </summary>
      <div class='dropdown-content z-10 w-80 mt-2'>
        <div class='bg-base-100 rounded-box shadow border border-base-300 p-3 space-y-3'>
          <div class='space-y-2 max-h-60 overflow-y-auto pr-1'>
            {rows.map((r) => (
              <div key={r.idx} class='flex items-center gap-2'>
                <select
                  class='select select-xs select-bordered flex-1'
                  value={r.key}
                  onInput={(e) =>
                    updateSort(prefix, r.idx, {
                      key: (e.target as HTMLSelectElement).value,
                    })}
                >
                  <option value=''>Column</option>
                  {sortKeyOptions.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <select
                  class='select select-xs select-bordered w-24'
                  value={r.dir}
                  onInput={(e) =>
                    updateSort(prefix, r.idx, {
                      dir: (e.target as HTMLSelectElement).value as
                        | 'asc'
                        | 'desc',
                    })}
                >
                  <option value='asc'>Asc</option>
                  <option value='desc'>Desc</option>
                </select>
                <button
                  type='button'
                  onClick={() => removeSort(prefix, r.idx)}
                  class='btn btn-xs btn-ghost'
                  title='Remove'
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type='button'
            class='btn btn-outline btn-xs w-full'
            onClick={() => addSort(prefix)}
          >
            <Plus class='h-3 w-3' />
            Add sort
          </button>
        </div>
      </div>
    </details>
  )
}
