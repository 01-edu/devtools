import { api } from './api.ts'
import { url } from '@01edu/signal-router'
import { Signal } from '@preact/signals'

// export
export type QueryHistoryItem = {
  query: string
  timestamp: string
  columns?: number
  rows?: number
}

// API signal for deployment queries
export const querier = api['GET/api/deployment/query'].signal()

// API signal for project deployments
export const deployments = api['GET/api/project/deployments'].signal()

// API signal for current project
export const project = api['GET/api/project'].signal()

export const runQuery = (query?: string) => {
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
