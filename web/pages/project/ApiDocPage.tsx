import { JSX } from 'preact'
import { effect } from '@preact/signals'
import { url } from '@01edu/signal-router'
import { DeploymentHeader } from '../../components/DeploymentHeader.tsx'
import { api } from '../../lib/api.ts'

type Documentation = {
  type: string
  description?: string
  optional?: boolean
  properties?: Record<string, Documentation>
  items?: Documentation
  values?: string[]
  union?: Documentation[]
}

export type EndpointDoc = {
  method: string
  path: string
  requiresAuth: boolean
  authFunction?: string
  description?: string
  input?: Documentation
  output?: Documentation
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

const InlineDescription = ({ description }: { description?: string }) => {
  if (!description) return null
  return <span style={{ color: '#6A9955' }}>{`// ${description}`}</span>
}

const ObjectDefinition = ({
  name,
  properties,
  level = 0,
  description,
}: {
  name: string
  properties: Record<string, Documentation>
  level?: number
  description?: string
}) => {
  const nestedTypes: JSX.Element[] = []

  return (
    <>
      <div class='mb-4'>
        {description && (
          <div style={{ color: '#6A9955' }}>{`// ${description}`}</div>
        )}
        <div>
          <span style={{ color: '#569CD6' }}>type</span>{' '}
          <span style={{ color: '#FFD700' }}>{name}</span>{' '}
          <span style={{ color: '#D4D4D4' }}>= {'{'}</span>
        </div>
        {Object.entries(properties).map(([key, prop]) => {
          const nestedTypeName = prop && prop.type === 'object'
            ? `${name}${key[0].toUpperCase()}${key.slice(1)}`
            : prop && prop.type === 'array' && prop.items?.type === 'object'
            ? `${name}${key[0].toUpperCase()}${key.slice(1)}Item`
            : null

          if (prop?.type === 'object' && prop.properties) {
            nestedTypes.push(
              <ObjectDefinition
                key={nestedTypeName}
                name={nestedTypeName!}
                properties={prop.properties}
                level={0}
                description={prop.description}
              />,
            )
          } else if (
            prop?.type === 'array' &&
            prop.items?.type === 'object' &&
            prop.items.properties
          ) {
            nestedTypes.push(
              <ObjectDefinition
                key={nestedTypeName}
                name={nestedTypeName!}
                properties={prop.items.properties}
                level={0}
                description={prop.items.description}
              />,
            )
          }

          return (
            <div key={key} style={{ marginLeft: (level + 1) * 20 }}>
              <span style={{ color: '#9CDCFE' }}>{key}</span>
              {prop?.optional && <span style={{ color: '#D4D4D4' }}>?</span>}
              <span style={{ color: '#D4D4D4' }}>:</span>{' '}
              {prop?.type === 'union' && prop.union
                ? (
                  <span style={{ color: '#D4D4D4' }}>
                    {prop.union.map((u, i) => (
                      <span key={i}>
                        {i > 0 && <span style={{ color: '#C586C0' }}>|</span>}
                        <span style={{ color: '#C586C0' }}>{u.type}</span>
                      </span>
                    ))}
                  </span>
                )
                : prop?.type === 'list' && prop.values
                ? (
                  <span style={{ color: '#CE9178' }}>
                    {prop.values.map((v) => `'${v}'`).join(' | ')}
                  </span>
                )
                : prop?.type === 'object'
                ? <span style={{ color: '#FFD700' }}>{nestedTypeName}</span>
                : prop?.type === 'array'
                ? (
                  <span style={{ color: '#FFD700' }}>
                    {prop.items?.type === 'object'
                      ? `${nestedTypeName}[]`
                      : prop.items?.type === 'list' && prop.items.values
                      ? `(${
                        prop.items.values.map((v) => `'${v}'`).join(' | ')
                      })[]`
                      : prop.items?.type === 'union' && prop.items.union
                      ? `(${prop.items.union.map((u) => u.type).join(' | ')})[]`
                      : `${prop.items?.type || 'any'}[]`}
                  </span>
                )
                : (
                  <span style={{ color: '#C586C0' }}>
                    {prop?.type || 'any'}
                  </span>
                )} <InlineDescription description={prop?.description} />
            </div>
          )
        })}
        <div>
          <span style={{ color: '#D4D4D4' }}>{'}'}</span>
        </div>
      </div>
      {nestedTypes}
    </>
  )
}

const TypeDefinition = ({
  typeName,
  doc,
}: {
  typeName: string
  doc: Documentation | null | undefined
}) => {
  if (!doc) {
    return (
      <div>
        <span style={{ color: '#569CD6' }}>type</span>{' '}
        <span style={{ color: '#FFD700' }}>{typeName}</span>{' '}
        <span style={{ color: '#D4D4D4' }}>=</span>{' '}
        <span style={{ color: '#C586C0' }}>null</span>{' '}
        <span style={{ color: '#D4D4D4' }}>|</span>{' '}
        <span style={{ color: '#C586C0' }}>undefined</span>{' '}
        <InlineDescription description='Documentation not provided' />
      </div>
    )
  }

  if (doc.type === 'object' && doc.properties) {
    return (
      <ObjectDefinition
        name={typeName}
        properties={doc.properties}
        description={doc.description}
      />
    )
  }

  if (doc.type === 'array' && doc.items) {
    const isObjectArray = doc.items.type === 'object' && doc.items.properties
    const itemTypeName = isObjectArray ? `${typeName}Item` : doc.items.type

    return (
      <div>
        <div>
          <span style={{ color: '#569CD6' }}>type</span>{' '}
          <span style={{ color: '#FFD700' }}>{typeName}</span>{' '}
          <span style={{ color: '#D4D4D4' }}>=</span>{' '}
          <span style={{ color: '#C586C0' }}>{itemTypeName}[]</span>{' '}
          <InlineDescription description={doc.description} />
        </div>
        {isObjectArray && (
          <ObjectDefinition
            name={itemTypeName!}
            properties={doc.items.properties!}
            description={doc.items.description}
          />
        )}
      </div>
    )
  }

  if (doc.type === 'list' && doc.values) {
    return (
      <div>
        <span style={{ color: '#569CD6' }}>type</span>{' '}
        <span style={{ color: '#FFD700' }}>{typeName}</span>{' '}
        <span style={{ color: '#D4D4D4' }}>=</span>{' '}
        <span style={{ color: '#CE9178' }}>
          {doc.values.map((v) => `'${v}'`).join(' | ')}
        </span>{' '}
        <InlineDescription description={doc.description} />
      </div>
    )
  }

  if (doc.type === 'union' && doc.union) {
    return (
      <div>
        <span style={{ color: '#569CD6' }}>type</span>{' '}
        <span style={{ color: '#FFD700' }}>{typeName}</span>{' '}
        <span style={{ color: '#D4D4D4' }}>=</span>{' '}
        <span style={{ color: '#D4D4D4' }}>
          {doc.union.map((u, i) => (
            <span key={i}>
              {i > 0 && <span style={{ color: '#C586C0' }}>|</span>}
              <span style={{ color: '#C586C0' }}>{u.type}</span>
            </span>
          ))}
        </span>{' '}
        <InlineDescription description={doc.description} />
      </div>
    )
  }

  return (
    <div>
      <span style={{ color: '#569CD6' }}>type</span>{' '}
      <span style={{ color: '#FFD700' }}>{typeName}</span>{' '}
      <span style={{ color: '#D4D4D4' }}>=</span>{' '}
      <span style={{ color: '#C586C0' }}>{doc.type}</span>{' '}
      <InlineDescription description={doc.description} />
    </div>
  )
}

const CodeBlock = ({ code, title }: { code: JSX.Element; title: string }) => (
  <div class='flex-1 w-full md:w-1/2 min-w-0 flex flex-col'>
    <h3 class='text-lg font-bold mb-2 text-base-content/80'>{title}</h3>
    <div class='relative flex-1 min-h-[200px] flex flex-col'>
      <pre class='bg-base-300/50 p-4 rounded border border-base-300 text-sm font-mono min-h-[200px] flex-1 overflow-x-auto'>
        <code class='inline-block min-w-min whitespace-pre-wrap text-base-content/90'>
          {code}
        </code>
      </pre>
    </div>
  </div>
)

const methodColors: Record<string, string> = {
  GET: 'bg-primary/20 text-primary',
  POST: 'bg-success/20 text-success',
  PUT: 'bg-warning/20 text-warning',
  DELETE: 'bg-error/20 text-error',
  PATCH: 'bg-secondary/20 text-secondary',
}

const ApiDocCard = ({ endpoint }: { endpoint: EndpointDoc }) => {
  const inputType = <TypeDefinition typeName='Input' doc={endpoint.input} />
  const outputType = <TypeDefinition typeName='Output' doc={endpoint.output} />

  return (
    <div class='w-full border border-base-300 rounded-lg overflow-hidden mb-6 bg-base-100 shadow-sm'>
      <div class='p-6 bg-base-100 border-b border-base-300'>
        <div class='flex justify-between items-center flex-wrap gap-2 mb-4'>
          <div class='flex items-center gap-3'>
            <span
              class={`px-2.5 py-1 rounded text-sm font-bold ${
                methodColors[endpoint.method] || 'bg-base-300 text-base-content'
              }`}
            >
              {endpoint.method}
            </span>
            <h2 class='text-2xl font-bold m-0 text-base-content'>
              {endpoint.path}
            </h2>
          </div>
          {endpoint.requiresAuth && (
            <span class='px-2.5 py-1 bg-warning/10 text-warning border border-warning/20 rounded text-sm font-bold'>
              Requires Auth
            </span>
          )}
        </div>
        <p class='text-base-content/70 mb-2'>{endpoint.description}</p>
        {endpoint.requiresAuth && endpoint.authFunction && (
          <p class='text-sm text-base-content/50'>
            Auth Function:{' '}
            <code class='bg-base-200 px-1 rounded'>
              {endpoint.authFunction}
            </code>
          </p>
        )}
      </div>

      <div class='p-6 bg-base-200/30'>
        <div class='flex flex-col xl:flex-row gap-6 items-stretch relative'>
          <CodeBlock code={inputType} title='Input' />
          <CodeBlock code={outputType} title='Output' />
        </div>
      </div>
    </div>
  )
}

// API signal for deployment docs
export const apiDocs = api['GET/api/deployment/doc'].signal()

// Fetch logic
effect(() => {
  const dep = url.params.dep
  if (dep) {
    apiDocs.fetch({ deployment: dep })
  }
})

export const ApiDocPage = () => {
  return (
    <div class='flex flex-col h-full min-h-0 grow-1 relative'>
      <DeploymentHeader />
      <div class='flex-1 min-h-0 overflow-y-auto bg-base-200/20'>
        <div class='mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6'>
          {apiDocs.error && (
            <div class='alert alert-error'>
              <span>Failed to load API docs: {String(apiDocs.error)}</span>
            </div>
          )}

          {apiDocs.pending && (
            <div class='flex items-center justify-center py-12'>
              <span class='loading loading-spinner loading-lg text-primary' />
            </div>
          )}

          {!apiDocs.pending && !apiDocs.error && apiDocs.data && (
            <>
              {apiDocs.data.length === 0
                ? (
                  <div class='p-12 text-center text-base-content/50 bg-base-100 rounded-lg border border-base-300'>
                    <div class='text-lg font-medium mb-2'>
                      No API endpoints found
                    </div>
                    <p>This deployment hasn't exposed any API documentation.</p>
                  </div>
                )
                : (
                  <div class='space-y-6'>
                    {apiDocs.data.map((endpoint) => (
                      <ApiDocCard
                        key={`${endpoint.method}${endpoint.path}`}
                        endpoint={endpoint as EndpointDoc}
                      />
                    ))}
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
