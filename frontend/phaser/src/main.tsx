import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type Phaser from 'phaser'
import { App } from '#App.tsx'
import '#style.css'

declare global {
  interface Window {
    __ROOT_PHASER_GAME__?: Phaser.Game
  }
}

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('Missing #root element')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
