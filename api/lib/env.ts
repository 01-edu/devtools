const env = Deno.env.toObject()

type AppEnvironments = 'dev' | 'test' | 'prod'

export const APP_ENV = env.APP_ENV || 'dev' as AppEnvironments
if (APP_ENV !== 'dev' && APP_ENV !== 'test' && APP_ENV !== 'prod') {
  throw Error(`APP_ENV: "${env.APP_ENV}" must be "dev", "test" or "prod"`)
}


export const PORT = Number(env.PORT) || 2119
const hostname = `localhost:${PORT || 8000}`
export const Picture_Dir = env.PICTURE_DIR || './.picture'


export const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID
if (!GOOGLE_CLIENT_ID) {
  throw Error('GOOGLE_CLIENT_ID: field required in the env')
}
export const CLIENT_SECRET = env.CLIENT_SECRET
if (!CLIENT_SECRET) {
  throw Error('CLIENT_SECRET: field required in the env')
}
export const REDIRECT_URI = env.REDIRECT_URI
if (!REDIRECT_URI) {
  throw Error('REDIRECT_URI: field required in the env')
}
export const ORIGIN = APP_ENV === 'prod'
  ? new URL(REDIRECT_URI).origin
  : `http://${hostname}`