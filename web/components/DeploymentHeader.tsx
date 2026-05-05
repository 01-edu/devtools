import { ComponentChildren } from 'preact'
import { navigate, url } from '@01edu/signal-router'
import { deployments, sidebarItems } from '../lib/shared.tsx'

export const DeploymentHeader = (
  { children }: { children?: ComponentChildren },
) => {
  const item = sidebarItems[url.params.sbi || Object.keys(sidebarItems)[0]]
  const dep = url.params.dep

  if (!dep && deployments.data?.length) {
    navigate({ params: { dep: deployments.data[0].url }, replace: true })
  }

  const onChangeDeployment = (e: Event) => {
    const v = (e.target as HTMLSelectElement).value
    // Clear page-specific params when switching deployment
    navigate({
      params: {
        dep: v,
        table: null,
        ft: null,
        st: null,
        qt: null,
        expanded: null,
        'row-id': null,
        tpage: null,
        q: null,
      },
      replace: true,
    })
  }

  return (
    <div class='navbar bg-base-100 border-b border-base-300 sticky top-0 z-10'>
      <div class='flex-1 min-w-0'>
        <div class='flex items-center gap-4 md:gap-6'>
          <div class='flex items-center gap-3 min-w-0'>
            {item?.icon && (
              <item.icon class='h-6 w-6 text-orange-500 shrink-0' />
            )}
            <span class='text-base md:text-lg font-semibold truncate'>
              {item?.label || 'Project'}
            </span>
          </div>
          <div class='min-w-[12rem]'>
            <select
              class='select select-sm md:select-md w-full'
              value={dep || ''}
              onChange={onChangeDeployment}
            >
              {deployments.data?.map((deployment) => (
                <option value={deployment.url} key={deployment.url}>
                  {deployment.url}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {children && <div class='flex-none'>{children}</div>}
    </div>
  )
}
