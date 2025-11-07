import { HardDrive, ListTodo } from 'lucide-preact'
import { api } from './api.ts'
import { DeploymentPage } from '../pages/DeploymentPage.tsx'
import { SidebarItem } from '../components/SideBar.tsx'
import { url } from './router.tsx'
import { Signal } from '@preact/signals'

// export
export type QueryHistoryItem = {
  query: string
  timestamp: string
  columns?: number
  rows?: number
}

// Sidebar items for project page
export const sidebarItems: Record<string, SidebarItem> = {
  'deployment': {
    icon: HardDrive,
    label: 'Deployment',
    component: DeploymentPage,
  },
  'tasks': { icon: ListTodo, label: 'Tasks', component: DeploymentPage },
} as const

// API signal for deployment queries
export const querier = api['GET/api/deployment/query'].signal()

// API signal for project deployments
export const deployments = api['GET/api/project/deployments'].signal()

// API signal for current project
export const project = api['GET/api/project'].signal()

export const onRun = (query: string) => {
  if (querier.pending) return
  const { dep, tab } = url.params
  if (dep && tab === 'queries' && query) {
    querier.fetch({ deployment: dep, sql: query })
  }
}

export const queriesHistory = new Signal<Record<string, QueryHistoryItem>>(
  JSON.parse(localStorage.getItem('saved_queries') || '{}'),
)
queriesHistory.subscribe((val) => {
  localStorage.setItem('saved_queries', JSON.stringify(val))
})
