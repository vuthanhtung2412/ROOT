import type {
  ActionSpec,
  AddAiPlayerInput,
  BotFactionId,
  BotSettings,
  GameState,
  PlayMode,
} from '#api/client.ts'
import type { CardCatalogEntry } from '#assets/gameAssets.ts'
import type {
  CardPileModalContent,
  CompletedQuestsModalContent,
  CraftedCardsModalContent,
} from '#ui/cardGalleryTypes.ts'
import type { DecreeCardOption } from '#game/eyrieActionComposerModels.ts'
import type { MenuFactionId } from '#game/menuPartySetup.ts'
import type { BotSettingsByFaction } from '@root/lib/bot-settings'
import type { DecreePanelView } from '#ui/decreePanel.ts'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'
import type { GameOverView } from '#ui/gameOverViewModel.ts'
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

export type WinnerHudState = GameOverView | null

export type LeaderPickHudState = {
  /** Offered card ids: Eyrie leaders, or Vagabond characters. */
  leaderIds: readonly string[]
  kind: SetupCardPickKind
} | null

export type GameDrawerHudState = {
  discardCount: number
  /** Only the host ends the game for everyone; a guest can only leave it. */
  canEndGame: boolean
  /** The local player has an action of this turn to take back. */
  canUndo: boolean
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

/** The Decree while the Eyrie stages an Add to Decree; null otherwise. */
export type DecreePanelHudState = {
  view: DecreePanelView
  /** Toggled from the dock; the staging is kept while the panel is off. */
  isOpen: boolean
} | null

/** A card dragged towards a Decree panel slot; null when none is. */
export type DecreeDragHudState = {
  cardId: string
  defId: string
  /** Pointer position, in viewport pixels. */
  x: number
  y: number
  /** Slot under the pointer that takes the card. */
  overColumn: string | null
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
  /** Model of the AI player in this seat; null for a human or a free seat. */
  aiModel: string | null
}

/** One faction of the lobby picker and who holds it. */
export type MenuFactionChoice = {
  faction: string
  takenBy: 'you' | 'other' | null
}

/** Online lobby shown in the menu while seats fill up. */
export type MenuLobbyHudState = {
  seats: MenuLobbySeat[]
  isHost: boolean
  canStart: boolean
  /** Open lobby: every faction, to pick from. Empty when seats are preset. */
  factionChoices: MenuFactionChoice[]
  /** Open lobby: seats nobody took yet. 0 when seats are preset. */
  openSeatCount: number
  /** Free-for-all, or the humans against the bots (Rootbotics 3.5.1). */
  playMode: PlayMode
  /** Why the host cannot start yet ("Needs 2 human players"); null when it can. */
  startBlockedReason: string | null
  /** Co-op: the bots the host may seat, marked like the faction choices. */
  botChoices: MenuFactionChoice[]
  /** Difficulty and traits the lobby holds per bot. */
  botSettings: BotSettingsByFaction
}

/** A change of the co-op table the host asks the server for. */
export type LobbyTableChange =
  | { kind: 'setPlayMode'; playMode: PlayMode }
  | { kind: 'addBot'; faction: BotFactionId }
  | { kind: 'setBotSettings'; faction: BotFactionId; settings: BotSettings }

export type MenuHudState = {
  statusText: string
  statusColor: string
  playPending: boolean
  showQaContinue: boolean
  /** A live online game is on the server: the start button reads "Join game". */
  lobbyOnServer: boolean
  /** An unfinished solo run is saved: "Continue solo run" shows. */
  soloRunSaved: boolean
  /** Non-null while this browser waits in an online lobby. */
  lobby: MenuLobbyHudState | null
}

export type MenuCallbacks = {
  /** Local hotseat: create lobby with chosen factions, join all, start. */
  onStartParty: (factions: string[], botSettings: BotSettingsByFaction) => void
  /** Solo: the player's faction, then the bots, in the browser (no server). */
  onStartSolo: (factions: MenuFactionId[], botSettings: BotSettingsByFaction) => void
  onQaContinue: () => void
  /** Back into the saved solo run. */
  onContinueSolo: () => void
  /** Create game: open a new online room. */
  onPlayOnline: () => void
  /** Join with code: enter the online room the host shared. */
  onJoinRoom: (roomCode: string) => void
  /** Open lobby: take a seat with this faction, or change the pick. */
  onPickFaction: (faction: string) => void
  /** Online host: seat an AI player (faction only in an open lobby). */
  onAddAiPlayer: (input: AddAiPlayerInput) => void
  /** Open lobby, host only: free the seat of a human or AI player. */
  onExpelPlayer: (seat: number) => void
  /** Open lobby, host only: play mode, bots and their settings. */
  onChangeLobbyTable: (change: LobbyTableChange) => void
  /** Online host: start once every seat is filled. */
  onStartOnline: () => void
  /** Online lobby: host closes the lobby, guest steps out of it. */
  onLeaveOnline: () => void
}

export type HudCallbacks = {
  onEndGame: () => void
  /** Take back the latest action of the current turn. */
  onUndo: () => void
  /** Game log: a clearing reference was clicked; show it on the map. */
  onLogClearingClick: (clearingId: number) => void
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
  /** Clearing stepper under the map: set selected count for that clearing. */
  onClearingStepper: (clearingId: number, count: number) => void
  onBattleOutsideClick: () => void
  onCardSelected: (cardId: string) => void
  onCardHold: (held: { defId: string; catalog: CardCatalogEntry }) => void
  /** Decree panel: a card is laid in a column, or moved to another one. */
  onDecreeCardStaged: (option: DecreeCardOption) => void
  /** Decree panel: a staged card goes back to the hand. */
  onDecreeCardTakenBack: (cardId: string) => void
  /** Decree panel: every staged card goes back to the hand. */
  onDecreeStagingCleared: () => void
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
  decreePanel: DecreePanelHudState
  decreeDrag: DecreeDragHudState
  /** Server log entries the viewer may see (other players' secrets redacted). */
  gameLog: readonly unknown[]
  statusMessage: StatusMessageHudState
  shell: HudShell
  bootLoading: BootLoadingHudState
  menu: MenuHudState | null
  /** The action dock folded down to its phase tab, off the map. */
  actionTrayCollapsed: boolean
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
  decreePanel: null,
  decreeDrag: null,
  gameLog: [],
  statusMessage: null,
  shell: 'boot',
  bootLoading: { progress: 0 },
  menu: null,
  actionTrayCollapsed: false,
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
  onUndo: () => undefined,
  onLogClearingClick: () => undefined,
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
  onClearingStepper: () => undefined,
  onBattleOutsideClick: () => undefined,
  onCardSelected: () => undefined,
  onCardHold: () => undefined,
  onDecreeCardStaged: () => undefined,
  onDecreeCardTakenBack: () => undefined,
  onDecreeStagingCleared: () => undefined,
}

const NOOP_MENU_CALLBACKS: MenuCallbacks = {
  onStartParty: () => undefined,
  onStartSolo: () => undefined,
  onQaContinue: () => undefined,
  onContinueSolo: () => undefined,
  onPlayOnline: () => undefined,
  onJoinRoom: () => undefined,
  onPickFaction: () => undefined,
  onAddAiPlayer: () => undefined,
  onExpelPlayer: () => undefined,
  onChangeLobbyTable: () => undefined,
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
  // How the player likes the action tray outlives one game.
  hudState = {
    ...CLEARED_GAME_HUD_STATE,
    actionTrayCollapsed: hudState.actionTrayCollapsed,
  }
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
