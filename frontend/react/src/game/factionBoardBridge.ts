import {
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'

/** Faction-board slice of the shared HUD store. */

export function subscribeFactionBoard(listener: () => void): () => void {
  return subscribeHud(listener)
}

export function getFactionBoardSnapshot(): FactionBoardViewModel | null {
  return getHudSnapshot().factionBoard
}

export function isFactionBoardOpen(): boolean {
  return getHudSnapshot().factionBoard !== null
}

export function factionBoardOpenSeat(): number | null {
  const view = getHudSnapshot().factionBoard
  if (view === null) {
    return null
  }
  return view.seat
}

export function showFactionBoard(view: FactionBoardViewModel): void {
  patchHud({ factionBoard: view })
}

export function hideFactionBoard(): void {
  if (getHudSnapshot().factionBoard === null) {
    return
  }
  patchHud({ factionBoard: null })
}
