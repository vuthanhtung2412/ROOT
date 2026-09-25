import type { ActionSpec, GameState } from '#api/client.ts'
import type { CardCatalogEntry } from '#assets/gameAssets.ts'
import type {
  CardPileModalContent,
  CraftedCardsModalContent,
} from '#ui/cardGalleryTypes.ts'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'
import type { ActionTraySyncOptions } from '#ui/ActionTray.ts'
import type { TurnBannerComposerView, TurnBannerViewModel } from '#ui/TurnBanner.ts'
import type { BattleOverlayViewModel } from '#ui/BattleOverlay.ts'

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
} | null

export type PlayerRailHudState = {
  state: GameState
  activeSeat: number
} | null

export type ActionTrayHudState = {
  actions: readonly ActionSpec[]
  actorSeat: number
  pending?: unknown
  options?: ActionTraySyncOptions | undefined
  state?: GameState
} | null

export type TurnBannerHudState = {
  turn: TurnBannerViewModel | null
  composer: TurnBannerComposerView | null
}

export type CardHandHudState = {
  state: GameState
  legalActions: readonly ActionSpec[]
  localSeat: number | null
  selectedCardIds: readonly string[]
  enabledCardIds: readonly string[] | null
} | null

export type StatusMessageHudState = {
  text: string
} | null

/** Which full-screen React shell is active. */
export type HudShell = 'boot' | 'menu' | 'game'

export type BootLoadingHudState = {
  progress: number
} | null

export type MenuHudState = {
  statusText: string
  statusColor: string
  playPending: boolean
  showQaContinue: boolean
}

export type MenuCallbacks = {
  onPlay: () => void
  onQaContinue: () => void
}

export type HudCallbacks = {
  onEndGame: () => void
  onOpenDiscardPile: () => void
  onReturnToMenu: () => void
  onLeaderPicked: (leaderId: string) => void
  onSeatClick: (seat: number) => void
  onCraftedCardsClick: (seat: number) => void
  onSupportersClick: (seat: number) => void
  onSelectAction: (spec: ActionSpec) => void
  onBannerConfirm: () => void
  onBannerCancel: () => void
  onBannerPickOption: (value: string) => void
  onBattleOutsideClick: () => void
  onCardSelected: (cardId: string) => void
  onCardHold: (held: { defId: string; catalog: CardCatalogEntry }) => void
}

/**
 * Shared React HUD snapshot. Surfaces migrate here one-by-one;
 * Game controller writes; React HUD reads via useSyncExternalStore.
 */
export type HudState = {
  factionBoard: FactionBoardViewModel | null
  craftedCards: CraftedCardsModalContent | null
  cardPile: CardPileModalContent | null
  cardDetail: CardDetailContent | null
  winner: WinnerHudState
  leaderPick: LeaderPickHudState
  gameDrawer: GameDrawerHudState
  playerRail: PlayerRailHudState
  actionTray: ActionTrayHudState
  turnBanner: TurnBannerHudState
  battleOverlay: BattleOverlayViewModel | null
  cardHand: CardHandHudState
  statusMessage: StatusMessageHudState
  shell: HudShell
  bootLoading: BootLoadingHudState
  menu: MenuHudState | null
}

const INITIAL_HUD_STATE: HudState = {
  factionBoard: null,
  craftedCards: null,
  cardPile: null,
  cardDetail: null,
  winner: null,
  leaderPick: null,
  gameDrawer: null,
  playerRail: null,
  actionTray: null,
  turnBanner: {
    turn: null,
    composer: null,
  },
  battleOverlay: null,
  cardHand: null,
  statusMessage: null,
  shell: 'boot',
  bootLoading: { progress: 0 },
  menu: null,
}

/** After leaving GameScene — menu shell, no boot flash. */
const CLEARED_GAME_HUD_STATE: HudState = {
  ...INITIAL_HUD_STATE,
  shell: 'menu',
  bootLoading: null,
  menu: null,
}

const NOOP_CALLBACKS: HudCallbacks = {
  onEndGame: () => undefined,
  onOpenDiscardPile: () => undefined,
  onReturnToMenu: () => undefined,
  onLeaderPicked: () => undefined,
  onSeatClick: () => undefined,
  onCraftedCardsClick: () => undefined,
  onSupportersClick: () => undefined,
  onSelectAction: () => undefined,
  onBannerConfirm: () => undefined,
  onBannerCancel: () => undefined,
  onBannerPickOption: () => undefined,
  onBattleOutsideClick: () => undefined,
  onCardSelected: () => undefined,
  onCardHold: () => undefined,
}

const NOOP_MENU_CALLBACKS: MenuCallbacks = {
  onPlay: () => undefined,
  onQaContinue: () => undefined,
}

let hudState: HudState = INITIAL_HUD_STATE
let hudCallbacks: HudCallbacks = NOOP_CALLBACKS
let menuCallbacks: MenuCallbacks = NOOP_MENU_CALLBACKS
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
  hudState = CLEARED_GAME_HUD_STATE
  hudCallbacks = NOOP_CALLBACKS
  menuCallbacks = NOOP_MENU_CALLBACKS
  notifyHudListeners()
}

export function setHudCallbacks(callbacks: HudCallbacks): void {
  hudCallbacks = callbacks
}

export function getHudCallbacks(): HudCallbacks {
  return hudCallbacks
}

export function setMenuCallbacks(callbacks: MenuCallbacks): void {
  menuCallbacks = callbacks
}

export function getMenuCallbacks(): MenuCallbacks {
  return menuCallbacks
}
