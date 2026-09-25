import type { JSX } from 'react'
import { FactionBoardModal } from '#react/FactionBoardModal.tsx'

/**
 * React HUD layer above the Phaser canvas.
 * Surfaces mount here as they migrate off Phaser.
 */
export function ReactHud(): JSX.Element {
  return (
    <>
      <FactionBoardModal />
    </>
  )
}
