import { Cloud, Zap } from 'lucide-preact'

export const LoginPage = () => {
  return (
    <div className='min-h-screen flex items-center justify-center p-4'>
      <div className='card bg-base-100 shadow-2xl rounded-box w-full max-w-md'>
        <div className='card-body p-6 sm:p-8'>
          <div className='text-center mb-6 sm:mb-8'>
            <h1 className='text-2xl sm:text-3xl font-bold text-base-content'>
              <span className='text-primary'>Dev</span> Tools
            </h1>
          </div>
          <form action='/api/login' method='get' className='space-y-4 sm:space-y-6'>
            <button
              type='submit'
              className='btn btn-primary w-full group'
            >
              <div className='flex items-center justify-center'>
                <Cloud className='w-4 h-4 sm:w-5 sm:h-5 mr-2 transition-transform group-hover:-translate-y-0.5' />
                <span>SSO Login</span>
                <Zap className='w-4 h-4 sm:w-5 sm:h-5 ml-2 transition-transform group-hover:translate-y-0.5' />
              </div>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
