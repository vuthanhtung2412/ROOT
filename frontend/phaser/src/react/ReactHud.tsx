import type { JSX } from 'react'
import { CardDetailOverlay } from '#react/CardDetailOverlay.tsx'
import {
  CardPileModal,
  CraftedCardsModal,
} from '#react/CardGalleryModal.tsx'
import { FactionBoardModal } from '#react/FactionBoardModal.tsx'
import {
  GameDrawer,
  LeaderPickOverlay,
  WinnerOverlay,
} from '#react/HudChrome.tsx'
import { PlayerRail } from '#react/PlayerRail.tsx'
import { ActionTray } from '#react/ActionTray.tsx'

/**
 * React HUD layer above the Phaser canvas.
 * Surfaces mount here as they migrate off Phaser.
 */
export function ReactHud(): JSX.Element {
  return (
    <>
      <PlayerRail />
      <ActionTray />
      <FactionBoardModal />
      <CraftedCardsModal />
      <CardPileModal />
      <CardDetailOverlay />
      <GameDrawer />
      <WinnerOverlay />
      <LeaderPickOverlay />
    </>
  )
}
