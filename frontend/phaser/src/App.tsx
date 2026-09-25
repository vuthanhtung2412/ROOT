import type { JSX } from 'react'
import { useRef } from 'react'
import { PhaserGame, type PhaserGameHandle } from '#PhaserGame.tsx'
import { FactionBoardModal } from '#react/FactionBoardModal.tsx'

export function App(): JSX.Element {
  const phaserRef = useRef<PhaserGameHandle>(null)

  return (
    <div id="app">
      <PhaserGame ref={phaserRef} />
      <FactionBoardModal />
    </div>
  )
}
