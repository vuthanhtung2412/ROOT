import type { JSX } from 'react'
import { ActionTray } from '#react/ActionTray.tsx'
import { BattleOverlay } from '#react/BattleOverlay.tsx'
import { BootOverlay } from '#react/BootOverlay.tsx'
import { CardDetailOverlay } from '#react/CardDetailOverlay.tsx'
import {
  CardPileModal,
  CompletedQuestsModal,
  CraftedCardsModal,
} from '#react/CardGalleryModal.tsx'
import { CardHand } from '#react/CardHand.tsx'
import { FactionBoardModal } from '#react/FactionBoardModal.tsx'
import {
  GameDrawer,
  LeaderPickOverlay,
  WinnerOverlay,
} from '#react/HudChrome.tsx'
import { MenuOverlay } from '#react/MenuOverlay.tsx'
import { PlayerRail } from '#react/PlayerRail.tsx'
import { StatusMessage } from '#react/StatusMessage.tsx'
import { TurnBanner } from '#react/TurnBanner.tsx'

/** React HUD layer above the game screen. */
export function ReactHud(): JSX.Element {
  return (
    <>
      <BootOverlay />
      <MenuOverlay />
      <TurnBanner />
      <BattleOverlay />
      <PlayerRail />
      <ActionTray />
      <CardHand />
      <StatusMessage />
      <FactionBoardModal />
      <CraftedCardsModal />
      <CompletedQuestsModal />
      <CardPileModal />
      <CardDetailOverlay />
      <GameDrawer />
      <WinnerOverlay />
      <LeaderPickOverlay />
    </>
  )
}
