import { Cloud, Zap } from 'lucide-preact'

export const LoginPage = () => {
  return (
    <div class='min-h-screen flex items-center justify-center p-4'>
      <div class='card bg-base-100 shadow-2xl rounded-box w-full max-w-md'>
        <div class='card-body p-6 sm:p-8'>
          <div class='text-center mb-6 sm:mb-8'>
            <h1 class='text-2xl sm:text-3xl font-bold text-base-content'>
              <span class='text-primary'>Dev</span> Tools
            </h1>
          </div>
          <form
            action='/api/login'
            method='get'
            class='space-y-4 sm:space-y-6'
          >
            <button
              type='submit'
              class='btn btn-primary w-full group'
            >
              <div class='flex items-center justify-center'>
                <Cloud class='w-4 h-4 sm:w-5 sm:h-5 mr-2 transition-transform group-hover:-translate-y-0.5' />
                <span>SSO Login</span>
                <Zap class='w-4 h-4 sm:w-5 sm:h-5 ml-2 transition-transform group-hover:translate-y-0.5' />
              </div>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
