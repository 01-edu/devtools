import { render } from 'preact'

const App = () => {
  return (
    <div class='bg-base-100'>
      <h1>Hello DevTools</h1>
    </div>
  )
}

const root = document.getElementById('app')
if (!root) throw new Error('Unable to find root element #app')
render(<App />, root)
