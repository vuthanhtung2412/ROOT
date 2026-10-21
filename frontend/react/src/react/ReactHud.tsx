import type { JSX } from 'react'
import { ActionTray } from '#react/ActionTray.tsx'
import { BattleClearingBadge } from '#react/BattleClearingBadge.tsx'
import { BattleOverlay } from '#react/BattleOverlay.tsx'
import { ClearingWoodSteppers } from '#react/ClearingWoodSteppers.tsx'
import { BootOverlay } from '#react/BootOverlay.tsx'
import { CardDetailOverlay } from '#react/CardDetailOverlay.tsx'
import { CardFlightLayer } from '#react/CardFlightLayer.tsx'
import {
  CardPileModal,
  CompletedQuestsModal,
  CraftedCardsModal,
} from '#react/CardGalleryModal.tsx'
import { CardHand } from '#react/CardHand.tsx'
import { DecreeDragGhost } from '#react/DecreeCardDrag.tsx'
import { DecreePanel } from '#react/DecreePanel.tsx'
import { FactionBoardModal } from '#react/FactionBoardModal.tsx'
import {
  GameDrawer,
  LeaderPickOverlay,
  WinnerOverlay,
} from '#react/HudChrome.tsx'
import { MenuOverlay } from '#react/MenuOverlay.tsx'
import { OptionGridModal } from '#react/OptionGridModal.tsx'
import { PaperFilters } from '#react/PaperFilters.tsx'
import { PlayerRail } from '#react/PlayerRail.tsx'
import { StatusMessage } from '#react/StatusMessage.tsx'
import { BotTurnBanner } from '#react/BotTurnBanner.tsx'
import { TurnBanner } from '#react/TurnBanner.tsx'

/** React HUD layer above the game screen. */
export function ReactHud(): JSX.Element {
  return (
    <>
      <PaperFilters />
      <BootOverlay />
      <MenuOverlay />
      <TurnBanner />
      <BotTurnBanner />
      <BattleOverlay />
      <BattleClearingBadge />
      <ClearingWoodSteppers />
      <PlayerRail />
      <CardFlightLayer />
      <DecreePanel />
      <ActionTray />
      <CardHand />
      <DecreeDragGhost />
      <StatusMessage />
      <FactionBoardModal />
      <OptionGridModal />
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
