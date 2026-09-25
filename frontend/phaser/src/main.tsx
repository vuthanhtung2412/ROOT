import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '#App.tsx'
import '#style.css'

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('Missing #root element')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
