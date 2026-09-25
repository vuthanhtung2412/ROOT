import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'

type FactionBoardListener = () => void

type FactionBoardBridgeState = {
  view: FactionBoardViewModel | null
}

const bridgeState: FactionBoardBridgeState = {
  view: null,
}

const listeners = new Set<FactionBoardListener>()

function notifyFactionBoardListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeFactionBoard(listener: FactionBoardListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getFactionBoardSnapshot(): FactionBoardViewModel | null {
  return bridgeState.view
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
  notifyFactionBoardListeners()
}

export function hideFactionBoard(): void {
  if (bridgeState.view === null) {
    return
  }
  bridgeState.view = null
  notifyFactionBoardListeners()
}
