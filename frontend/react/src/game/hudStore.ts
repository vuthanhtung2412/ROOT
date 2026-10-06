import type { ActionSpec, GameState } from '#api/client.ts'
import type { CardCatalogEntry } from '#assets/gameAssets.ts'
import type {
  CardPileModalContent,
  CompletedQuestsModalContent,
  CraftedCardsModalContent,
} from '#ui/cardGalleryTypes.ts'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'
import type { ActionTraySyncOptions } from '#ui/ActionTray.ts'
import type { TurnBannerComposerView, TurnBannerViewModel } from '#ui/TurnBanner.ts'
import type { BattleOverlayViewModel } from '#ui/BattleOverlay.ts'
import type { BattleMark } from '#game/battleOverlayModel.ts'
import {
  EMPTY_CARD_FLIGHT_BATCH,
  type CardFlightBatch,
} from '#game/cardFlights.ts'
import type { SetupCardPickKind } from '#ui/setupCardPick.ts'

export type HudListener = () => void

export type CardDetailContent = {
  defId: string
  catalog: CardCatalogEntry
}

export type WinnerHudState = {
  winnerFaction: string
} | null

export type LeaderPickHudState = {
  /** Offered card ids: Eyrie leaders, or Vagabond characters. */
  leaderIds: readonly string[]
  kind: SetupCardPickKind
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

export type MenuLobbySeat = {
  faction: string
  occupied: boolean
  isLocalPlayer: boolean
}

/** Online lobby shown in the menu while seats fill up. */
export type MenuLobbyHudState = {
  seats: MenuLobbySeat[]
  isHost: boolean
  canStart: boolean
}

export type MenuHudState = {
  statusText: string
  statusColor: string
  playPending: boolean
  showQaContinue: boolean
  /** Non-null while this browser waits in an online lobby. */
  lobby: MenuLobbyHudState | null
}

export type MenuCallbacks = {
  /** Local hotseat: create lobby with chosen factions, join all, start. */
  onStartParty: (factions: string[]) => void
  onQaContinue: () => void
  /** Online: create a lobby with the chosen factions and take seat 1. */
  onHostOnline: (factions: string[]) => void
  /** Online: take the next free seat of the waiting lobby. */
  onJoinOnline: () => void
  /** Online host: start once every seat is filled. */
  onStartOnline: () => void
  /** Online lobby: host closes the lobby, guest steps out of it. */
  onLeaveOnline: () => void
}

export type HudCallbacks = {
  onEndGame: () => void
  onOpenDiscardPile: () => void
  onReturnToMenu: () => void
  onLeaderPicked: (leaderId: string) => void
  onSeatClick: (seat: number) => void
  onCraftedCardsClick: (seat: number) => void
  onCompletedQuestsClick: (seat: number) => void
  onSupportersClick: (seat: number) => void
  onPublicHandClick: (seat: number) => void
  onLostSoulsClick: () => void
  onSelectAction: (spec: ActionSpec) => void
  /** Vagabond board: item clicked to move between its track and the Satchel. */
  onRearrangeItem: (spec: ActionSpec) => void
  /** Vagabond board: face-up quest clicked to claim it. */
  onQuestPicked: (spec: ActionSpec) => void
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
  completedQuests: CompletedQuestsModalContent | null
  cardPile: CardPileModalContent | null
  cardDetail: CardDetailContent | null
  winner: WinnerHudState
  leaderPick: LeaderPickHudState
  gameDrawer: GameDrawerHudState
  playerRail: PlayerRailHudState
  actionTray: ActionTrayHudState
  turnBanner: TurnBannerHudState
  battleOverlay: BattleOverlayViewModel | null
  /** Sides shown on the clearing of the battle being resolved. */
  battleMark: BattleMark | null
  /** Crafted / revealed cards flying out of the rail (last server update). */
  cardFlights: CardFlightBatch
  cardHand: CardHandHudState
  statusMessage: StatusMessageHudState
  shell: HudShell
  bootLoading: BootLoadingHudState
  menu: MenuHudState | null
}

const INITIAL_HUD_STATE: HudState = {
  factionBoard: null,
  craftedCards: null,
  completedQuests: null,
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
  battleMark: null,
  cardFlights: EMPTY_CARD_FLIGHT_BATCH,
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
  onCompletedQuestsClick: () => undefined,
  onSupportersClick: () => undefined,
  onPublicHandClick: () => undefined,
  onLostSoulsClick: () => undefined,
  onSelectAction: () => undefined,
  onRearrangeItem: () => undefined,
  onQuestPicked: () => undefined,
  onBannerConfirm: () => undefined,
  onBannerCancel: () => undefined,
  onBannerPickOption: () => undefined,
  onBattleOutsideClick: () => undefined,
  onCardSelected: () => undefined,
  onCardHold: () => undefined,
}

const NOOP_MENU_CALLBACKS: MenuCallbacks = {
  onStartParty: () => undefined,
  onQaContinue: () => undefined,
  onHostOnline: () => undefined,
  onJoinOnline: () => undefined,
  onStartOnline: () => undefined,
  onLeaveOnline: () => undefined,
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
