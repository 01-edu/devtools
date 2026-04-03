import { effect } from '@preact/signals'
import { api } from './api.ts'
import { url, navigate } from '@01edu/signal-router'

export const user = api['GET/api/user/me'].signal()
user.fetch()

effect(() => {
  const { dep } = url.params
  const pathParts = url.path.split('/')
  const slug = url.path.split('/')[2]
  if (user.data?.id === 'local' && dep !== 'dev' && slug !== 'local') {
  	pathParts[2] = 'local'
  	const href = pathParts.join('/')
    navigate({ href, params: { dep: 'dev' }, replace: true })
  }
})