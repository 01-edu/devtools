// URL filter schema (prefix = 't' | 'l'):
// f{prefix}c0=key, f{prefix}o0=op, f{prefix}v0=value

import { ArrowUpDown, Filter, Plus } from 'lucide-preact'
import { A, navigate, url } from '../lib/router.tsx'

// f{prefix}c1=..., f{prefix}o1=..., f{prefix}v1=...
type FilterRow = { idx: number; key: string; op: string; value: string }

const filterOperators = ['=', '!=', '>', '>=', '<', '<=', 'contains'] as const
type FilterOperator = typeof filterOperators[number]

function parseFilters(prefix: string): FilterRow[] {
  const ids: number[] = []
  const re = new RegExp(`^f${prefix}c(\\d+)$`)
  for (const k in url.params) {
    const m = k.match(re)
    if (m) ids.push(Number(m[1]))
  }
  ids.sort((a, b) => a - b)
  if (!ids.length) return [{ idx: 0, key: '', op: '=', value: '' }]

  const rows: FilterRow[] = []
  for (const idx of ids) {
    const key = (url.params[`f${prefix}c${idx}`] as string) ?? ''
    const rawOp = (url.params[`f${prefix}o${idx}`] as string) ?? '='
    const op: FilterOperator =
      (filterOperators as readonly string[]).includes(rawOp)
        ? rawOp as FilterOperator
        : '='
    const value = (url.params[`f${prefix}v${idx}`] as string) ?? ''
    rows.push({ idx, key, op, value })
  }
  return rows
}

function setFilters(prefix: string, rows: FilterRow[]) {
  const normalized = rows.map((r, i) => ({ ...r, idx: i }))
  const next: Record<string, string> = {}
  for (const k in url.params) {
    if (/^f[tl][cov]\d+$/.test(k)) continue
    const v = url.params[k]
    if (v != null) next[k] = v as string
  }

  for (const r of normalized) {
    next[`f${prefix}c${r.idx}`] = r.key
    next[`f${prefix}o${r.idx}`] = r.op
    next[`f${prefix}v${r.idx}`] = r.value
  }

  const allEmpty = normalized.every((r) => !r.key && !r.value)
  if (allEmpty) {
    for (const k in next) {
      if (k.startsWith(`f${prefix}`)) delete next[k]
    }
  }

  navigate({ params: next, replace: true })
}

function addFilter(prefix: string) {
  const rows = parseFilters(prefix)
  setFilters(prefix, [...rows, {
    idx: rows.length,
    key: '',
    op: '=',
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

// --- Sort (URL) -------------------------------------------------------------
// s{prefix}c{n}=column, s{prefix}d{n}=asc|desc  (prefix: t = tables, l = logs)
type SortRow = { idx: number; key: string; dir: 'asc' | 'desc' }

function parseSort(prefix: string): SortRow[] {
  const ids: number[] = []
  const re = new RegExp(`^s${prefix}c(\\d+)$`)
  for (const k in url.params) {
    const m = k.match(re)
    if (m) ids.push(Number(m[1]))
  }
  ids.sort((a, b) => a - b)
  if (!ids.length) return [{ idx: 0, key: '', dir: 'asc' }]
  return ids.map((idx) => ({
    idx,
    key: (url.params[`s${prefix}c${idx}`] as string) ?? '',
    dir:
      ((url.params[`s${prefix}d${idx}`] as string) === 'desc' ? 'desc' : 'asc'),
  }))
}

function setSort(prefix: string, rows: SortRow[]) {
  const normalized = rows.map((r, i) => ({ ...r, idx: i }))
  const next: Record<string, string> = {}
  // preserve non-sort params
  for (const k in url.params) {
    if (/^s[tl][cd]\d+$/.test(k)) continue
    const v = url.params[k]
    if (v != null) next[k] = v as string
  }
  const allEmpty = normalized.every((r) => !r.key)
  if (!allEmpty) {
    for (const r of normalized) {
      next[`s${prefix}c${r.idx}`] = r.key
      next[`s${prefix}d${r.idx}`] = r.dir
    }
  }
  navigate({ params: next, replace: true })
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

                <A
                  class='btn btn-xs btn-ghost'
                  params={{
                    [`f${prefix}c${r.idx}`]: undefined,
                    [`f${prefix}o${r.idx}`]: undefined,
                    [`f${prefix}v${r.idx}`]: undefined,
                  }}
                  title='Remove'
                >
                  ✕
                </A>
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
                <A
                  params={{
                    [`s${prefix}c${r.idx}`]: undefined,
                    [`s${prefix}d${r.idx}`]: undefined,
                  }}
                  class='btn btn-xs btn-ghost'
                  title='Remove'
                >
                  ✕
                </A>
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
