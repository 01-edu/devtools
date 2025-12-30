import { ENV } from '@01edu/api/env'

export const PORT = Number(ENV('PORT', '2119'))
export const PICTURE_DIR = ENV('PICTURE_DIR', './.picture')
export const GOOGLE_CLIENT_ID = ENV('GOOGLE_CLIENT_ID')
export const CLIENT_SECRET = ENV('CLIENT_SECRET')
export const REDIRECT_URI = ENV('REDIRECT_URI')
export const ORIGIN = new URL(REDIRECT_URI).origin
export const SECRET = ENV(
  'SECRET',
  'iUokBru8WPSMAuMspijlt7F-Cnpqyg84F36b1G681h0',
)

export const CLICKHOUSE_HOST = ENV('CLICKHOUSE_HOST')
export const CLICKHOUSE_USER = ENV('CLICKHOUSE_USER')
export const CLICKHOUSE_PASSWORD = ENV('CLICKHOUSE_PASSWORD')

// Optional interval (ms) for refreshing external SQL database schemas
// Defaults to 24 hours
export const DB_SCHEMA_REFRESH_MS = Number(
  ENV('DB_SCHEMA_REFRESH_MS', `${24 * 60 * 60 * 1000}`),
)
