import { respond } from '@01edu/api/response'

export default {
  write: (_table, data, _query, _ctx) => {
    if (data && typeof data === 'object' && 'password' in data) {
      throw respond.ForbiddenError({
        message: 'Password update is not allowed.',
      })
    }
    return data
  },
  config: {
    targets: ['users'],
  },
}
