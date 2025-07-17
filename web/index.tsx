import { render } from 'preact'

const App = () => {
  return <h1>Hello DevTools</h1>
}

const root = document.getElementById('app')
if (!root) throw new Error('Unable to find root element #app')
render(<App />, root)
