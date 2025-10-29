import { X, Trash2, Copy, Check } from 'lucide-preact'
import { api, ApiOutput } from '../lib/api.ts'
import { effect } from '@preact/signals'
import { url } from '../lib/router.tsx'

type TableColumn = ApiOutput['GET/api/deployment/schema']['tables'][number]['columns'][number]
// type Log = ApiOutput['']
const schema = api['GET/api/deployment/schema'].signal()
const tablesMap = new Map<string, TableColumn[]>([])

effect(() => {
  const tables = schema.data?.tables ?? []
  tablesMap.clear()
  for (const { table, columns } of tables) {
    tablesMap.set(table, columns)
  }
})

const getFieldType = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int8' : 'float'
  }
  if (typeof value === 'boolean') return 'boolean'
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
const {tab,table} = url.params

  // const handleInputChange = (key: string, inputValue: string) => {
  //   if (!onChange) return

  //   const originalValue = data[key]
  //   const fieldType = getFieldType(originalValue)

  //   let parsedValue: any = inputValue

  //   if (fieldType === 'int8') {
  //     parsedValue = inputValue === '' ? 0 : parseInt(inputValue, 10)
  //   } else if (fieldType === 'float') {
  //     parsedValue = inputValue === '' ? 0 : parseFloat(inputValue)
  //   } else if (fieldType === 'boolean') {
  //     parsedValue = inputValue === 'true'
  //   }

  //   onChange(key, parsedValue)
  // }

  return (
    <div class='h-full flex flex-col bg-base-200'>
      <div class='flex items-center justify-between p-4 border-b border-base-300'>
        <div>
          <h3 class='text-lg font-semibold'>Edit row</h3>
          {/* {tableName && (
            <p class='text-sm text-base-content/70 mt-0.5'>
              {tableName}
            </p>
          )} */}
        </div>
        <div class='flex items-center gap-2'>
          {/* {onDelete && ( */}
            <button
              class='btn btn-ghost btn-sm btn-square'
              // onClick={onDelete}
              title='Delete row'
            >
              <Trash2 size={18} />
            </button>
          {/* )} */}
          {/* {onClose && ( */}
            <button
              class='btn btn-ghost btn-sm btn-square'
              // onClick={onClose}
              title='Close'
            >
              <X size={18} />
            </button>
          {/* )} */}
        </div>
      </div>

      {/* Content */}
      {data ? (
        <>
          <div class='flex-1 overflow-auto p-4'>
            <div class='space-y-4'>
              {Object.entries(data).map(([key, value]) => {
                const type = getFieldType(value)
                return (
                  <div key={key} class='space-y-1'>
                  <label class='text-sm font-medium text-base-content/90'>
                    {key}
                  </label>
                  {type === 'json' ? (
                    <textarea
                      class='textarea textarea-bordered w-full h-32 font-mono text-sm'
                      value={JSON.stringify(value, null, 2)}
                      // onChange={(e) => handleInputChange(key, e.currentTarget.value)}
                    />
                  ) : (
                   <input
                    type={type === 'int8' || type === 'float' ? 'number' : 'text'}
                    class='input input-bordered w-full bg-base-300 focus:bg-base-100'
                    value={value?.toString() ?? ''}
                    // onInput={(e) => handleInputChange(key, e.currentTarget.value)}
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

          {/* Footer */}
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