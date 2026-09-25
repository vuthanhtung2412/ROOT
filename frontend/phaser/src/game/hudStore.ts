import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'
import type {
  CardPileModalContent,
  CraftedCardsModalContent,
} from '#ui/cardGalleryTypes.ts'

export type HudListener = () => void

/**
 * Shared React HUD snapshot. Surfaces migrate here one-by-one;
 * Phaser GameScene writes, React reads via useSyncExternalStore.
 */
export type HudState = {
  factionBoard: FactionBoardViewModel | null
  craftedCards: CraftedCardsModalContent | null
  cardPile: CardPileModalContent | null
}

const INITIAL_HUD_STATE: HudState = {
  factionBoard: null,
  craftedCards: null,
  cardPile: null,
}

let hudState: HudState = INITIAL_HUD_STATE
const listeners = new Set<HudListener>()

function notifyHudListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeHud(listener: HudListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getHudSnapshot(): HudState {
  return hudState
}

export function patchHud(partial: Partial<HudState>): void {
  hudState = {
    ...hudState,
    ...partial,
  }
  notifyHudListeners()
}

export function resetHud(): void {
  hudState = INITIAL_HUD_STATE
  notifyHudListeners()
}
