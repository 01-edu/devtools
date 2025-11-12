import { X, Trash2, Copy, Check } from 'lucide-preact'
import { api, ApiOutput } from '../lib/api.ts'
import { effect } from '@preact/signals'
import { A, url } from '../lib/router.tsx'

type TableColumn = ApiOutput['GET/api/deployment/schema']['tables'][number]['columns'][number]
type Log = ApiOutput['POST/api/deployment/logs'][number]
const schema = api['GET/api/deployment/schema'].signal()
const tablesMap = new Map<string, TableColumn[]>([])

type LogColumn = {
    name: keyof Log;
    type: string;
    ordinal: number;
}

const logDef: LogColumn[] = [
  { name: 'id', type: 'UUID', ordinal: 1 },
  { name: 'timestamp', type: 'DateTime64(3, \'UTC\')', ordinal: 2 },
  { name: 'trace_id', type: 'FixedString(16)', ordinal: 3 },
  { name: 'span_id', type: 'FixedString(16)', ordinal: 4 },
  { name: 'severity_number', type: 'UInt8', ordinal: 5 },
  { name: 'severity_text', type: 'LowCardinality(String)', ordinal: 6 },
  { name: 'body', type: 'Nullable(String)', ordinal: 7 },
  { name: 'attributes', type: 'JSON', ordinal: 8 },
  { name: 'event_name', type: 'LowCardinality(String)', ordinal: 9 },
  { name: 'service_name', type: 'LowCardinality(String)', ordinal: 10 },
  { name: 'service_version', type: 'LowCardinality(String)', ordinal: 11 },
  { name: 'service_instance_id', type: 'String', ordinal: 12 }
]

effect(() => {
  const dep = url.params.dep
  if (!dep) return
  schema.fetch({url: dep})
})

effect(() => {
  const tables = schema.data?.tables ?? []
  tablesMap.clear()
  for (const { table, columns } of tables) {
    tablesMap.set(table, columns)
  }
})

const getFieldType = (value: unknown,type: string): string => {
  const typeLower = type.toLowerCase()
  if (typeLower === 'json') return 'json'
  if (typeLower.startsWith('int') || typeLower.startsWith('uint')) return 'number'
  if (typeLower.startsWith('float') || typeLower.startsWith('double')) return 'float'
  if (typeLower === 'boolean' || typeLower === 'bool') return 'checkbox'
  if (value === null || value === undefined) return 'text'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'number' : 'float'
  }
  if (typeof value === 'boolean') return 'checkbox'
  if (typeof value === 'object') return 'json'
  return 'text'
}

const data={
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    attributes: { role: 'admin', active: true, age: 30 },
  }
export const RowDetail = () => {
const {tab,table,view} = url.params

const tableColumns = tab === 'logs' ? logDef : tablesMap.get(table || '') ?? []

  return (
    <div class='h-full flex flex-col bg-base-200'>
      <div class='flex items-center justify-between p-4 border-b border-base-300'>
        <div>
          <h3 class='text-lg font-semibold'>Edit row</h3>
        </div>
        <div class='flex items-center gap-2'>
         {view && ( 
            <button
              class='btn btn-ghost btn-sm btn-square'
              title='Delete row'
            >
              <Trash2 size={18} />
            </button>
          )} 
        </div>
      </div>

      {/* Content */}
      {data ? (
        <>
          <div class='flex-1 overflow-auto p-4'>
            <div class='space-y-4'>
              {tableColumns.map(({ name, type }) => {
                const value = data[name as keyof typeof data]
                const fieldType = getFieldType(value, type)
                return (
                  <div key={name} class='space-y-1'>
                  <label class='text-sm font-medium text-base-content/90'>
                    {name}
                  </label>
                  {fieldType === 'json' ? (
                    <textarea
                      class='textarea textarea-bordered w-full h-32 font-mono text-sm'
                      value={JSON.stringify(value, null, 2)}
                    />
                  ) : (
                   <input
                    type={fieldType}
                    class='input input-bordered w-full bg-base-300 focus:bg-base-100'
                    value={value?.toString() ?? ''}
                  />
                  )}
                  <span class='text-xs text-base-content/50'>
                    Type: {type}
                  </span>
                </div>
                )
              })}
            </div>
          </div>

          <div class='p-4 border-t border-base-300 flex gap-2'>
            <button class='btn btn-ghost'>
              Cancel
            </button>
            {/* {onSave && ( */}
              <button
                class='btn btn-primary'
                // onClick={() => onSave(data)}2
              >
                Save
              </button>
            {/* )} */}
          </div>
        </>
      ) : (
        <div class='flex-1 flex items-center justify-center p-4'>
          <div class='text-center text-base-content/50'>
            <p class='text-lg font-medium'>No row selected</p>
            <p class='text-sm mt-2'>
              Select a row from the table to edit
            </p>
          </div>
        </div>
      )}
    </div>
  )
}