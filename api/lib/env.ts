const env = Deno.env.toObject()

type AppEnvironments = 'dev' | 'test' | 'prod'

export const APP_ENV = env.APP_ENV || 'dev' as AppEnvironments
if (APP_ENV !== 'dev' && APP_ENV !== 'test' && APP_ENV !== 'prod') {
  throw Error(`APP_ENV: "${env.APP_ENV}" must be "dev", "test" or "prod"`)
}

export const PORT = Number(env.PORT) || 2119
