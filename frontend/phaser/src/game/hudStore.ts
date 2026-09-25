import type { CardCatalogEntry } from '#assets/gameAssets.ts'
import type {
  CardPileModalContent,
  CraftedCardsModalContent,
} from '#ui/cardGalleryTypes.ts'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'

export type HudListener = () => void

export type CardDetailContent = {
  defId: string
  catalog: CardCatalogEntry
}

export type WinnerHudState = {
  winnerFaction: string
} | null

export type LeaderPickHudState = {
  leaderIds: readonly string[]
} | null

export type GameDrawerHudState = {
  discardCount: number
  endGameArmed: boolean
}

export type HudCallbacks = {
  onEndGame: () => void
  onOpenDiscardPile: () => void
  onReturnToMenu: () => void
  onLeaderPicked: (leaderId: string) => void
}

/**
 * Shared React HUD snapshot. Surfaces migrate here one-by-one;
 * Phaser GameScene writes, React reads via useSyncExternalStore.
 */
export type HudState = {
  factionBoard: FactionBoardViewModel | null
  craftedCards: CraftedCardsModalContent | null
  cardPile: CardPileModalContent | null
  cardDetail: CardDetailContent | null
  winner: WinnerHudState
  leaderPick: LeaderPickHudState
  gameDrawer: GameDrawerHudState
}

const INITIAL_HUD_STATE: HudState = {
  factionBoard: null,
  craftedCards: null,
  cardPile: null,
  cardDetail: null,
  winner: null,
  leaderPick: null,
  gameDrawer: {
    discardCount: 0,
    endGameArmed: false,
  },
}

let hudState: HudState = INITIAL_HUD_STATE
let hudCallbacks: HudCallbacks = {
  onEndGame: () => undefined,
  onOpenDiscardPile: () => undefined,
  onReturnToMenu: () => undefined,
  onLeaderPicked: () => undefined,
}
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

export function setHudCallbacks(callbacks: HudCallbacks): void {
  hudCallbacks = callbacks
}

export function getHudCallbacks(): HudCallbacks {
  return hudCallbacks
}
