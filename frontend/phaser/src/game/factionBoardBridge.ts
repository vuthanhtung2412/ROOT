import { EventBus } from '#game/EventBus.ts'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'

export const FACTION_BOARD_SHOW_EVENT = 'faction-board:show'
export const FACTION_BOARD_HIDE_EVENT = 'faction-board:hide'

type FactionBoardBridgeState = {
  view: FactionBoardViewModel | null
}

const bridgeState: FactionBoardBridgeState = {
  view: null,
}

export function isFactionBoardOpen(): boolean {
  return bridgeState.view !== null
}

export function factionBoardOpenSeat(): number | null {
  if (bridgeState.view === null) {
    return null
  }
  return bridgeState.view.seat
}

export function showFactionBoard(view: FactionBoardViewModel): void {
  bridgeState.view = view
  EventBus.emit(FACTION_BOARD_SHOW_EVENT, view)
}

export function hideFactionBoard(): void {
  if (bridgeState.view === null) {
    return
  }
  bridgeState.view = null
  EventBus.emit(FACTION_BOARD_HIDE_EVENT)
}
