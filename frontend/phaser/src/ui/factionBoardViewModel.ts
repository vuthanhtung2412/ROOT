import {
  EYRIE_ABILITIES,
  EYRIE_ROOST_TRACK,
  EYRIE_ROOST_TRACK_SLOT_COUNT,
  EYRIE_TURMOIL_CHEAT,
  EYRIE_TURN_CHEAT,
  lookupEyrieBoardLeader,
  type EyrieAbilityInfo,
  type EyrieLeaderInfo,
  type EyrieRoostTrackColumn,
} from '../assets/eyrieBoardCatalog.ts'
import { GAME_ASSET_KEYS, lookupCardCatalog } from '../assets/gameAssets.ts'
import {
  MARQUISE_ABILITIES,
  MARQUISE_BUILDING_TRACK,
  MARQUISE_TRACK_SLOT_COUNT,
  MARQUISE_TURN_CHEAT,
  type MarquiseAbilityInfo,
  type MarquiseTrackColumn,
} from '../assets/marquiseBoardCatalog.ts'
import type { GameState } from '../api/client.ts'

export type CraftedLookup = {
  cardNames: string[]
  itemTypes: string[]
}

export const EYRIE_DECREE_COLUMNS = [
  'recruit',
  'move',
  'battle',
  'build',
] as const

export type EyrieDecreeColumnId = (typeof EYRIE_DECREE_COLUMNS)[number]

export type EyrieDecreeColumnView = {
  columnId: EyrieDecreeColumnId
  regionId: string
  suits: string[]
}

export type MarquiseBoardViewModel = {
  kind: 'marquise'
  seat: number
  factionName: string
  victoryPoints: number
  warriors: number
  wood: number
  handSize: number
  crafted: CraftedLookup
  abilities: readonly MarquiseAbilityInfo[]
  turnCheat: readonly string[]
  trackColumns: readonly MarquiseTrackColumn[]
  /** Columns emptied left→right (building on map). */
  emptiedColumnCount: {
    sawmill: number
    workshop: number
    recruiter: number
  }
  boardTextureKey: string
}

export type EyrieBoardViewModel = {
  kind: 'eyrie'
  seat: number
  factionName: string
  victoryPoints: number
  warriors: number
  handSize: number
  crafted: CraftedLookup
  abilities: readonly EyrieAbilityInfo[]
  turnCheat: readonly string[]
  turmoilCheat: readonly string[]
  roostTrack: readonly EyrieRoostTrackColumn[]
  /** Roosts on map = emptied track slots from left. */
  roostsOnMap: number
  leader: EyrieLeaderInfo | null
  decreeColumns: readonly EyrieDecreeColumnView[]
  /** Current decree resolve column, if any. */
  activeDecreeColumn: EyrieDecreeColumnId | null
  boardTextureKey: string
}

export type FactionBoardViewModel = MarquiseBoardViewModel | EyrieBoardViewModel

type MarquiseBoardData = {
  kind: 'marquise'
  supply: { warriors: number; wood: number }
  tracks: {
    sawmill: { placed: number }
    workshop: { placed: number }
    recruiter: { placed: number }
  }
}

type EyrieDecreeCard = { id: string; defId: string }

type EyrieBoardData = {
  kind: 'eyrie'
  supply: { warriors: number }
  leader: string | null
  roostTrack: { placed: number }
  decree?: Partial<Record<EyrieDecreeColumnId, EyrieDecreeCard[]>>
}

type PlayerForBoard = {
  seat: number
  faction: string
  vp: number
  hand: Array<{ id: string; defId: string }>
  playArea?: Array<{ id: string; defId: string }>
  craftedItems?: string[]
  board?: unknown
}

function isMarquiseBoardData(value: unknown): value is MarquiseBoardData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Reflect.get(value, 'kind') === 'marquise'
}

function isEyrieBoardData(value: unknown): value is EyrieBoardData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Reflect.get(value, 'kind') === 'eyrie'
}

function emptiedBuildingColumns(placedOnTrack: number): number {
  const emptied = MARQUISE_TRACK_SLOT_COUNT - placedOnTrack
  if (emptied < 0) {
    return 0
  }
  if (emptied > MARQUISE_TRACK_SLOT_COUNT) {
    return MARQUISE_TRACK_SLOT_COUNT
  }
  return emptied
}

function roostsOnMapFromTrack(placedOnTrack: number): number {
  const roostsOnMap = EYRIE_ROOST_TRACK_SLOT_COUNT - placedOnTrack
  if (roostsOnMap < 0) {
    return 0
  }
  if (roostsOnMap > EYRIE_ROOST_TRACK_SLOT_COUNT) {
    return EYRIE_ROOST_TRACK_SLOT_COUNT
  }
  return roostsOnMap
}

function craftedLookup(player: PlayerForBoard): CraftedLookup {
  const playArea = player.playArea ?? []
  const craftedItems = player.craftedItems ?? []
  return {
    cardNames: playArea.map((card) => card.defId),
    itemTypes: [...craftedItems],
  }
}

function suitForDecreeCard(defId: string): string {
  if (defId === 'VIZIER') {
    return 'bird'
  }
  return lookupCardCatalog(defId)?.suit ?? '?'
}

const DECREE_SUIT_ORDER = ['bird', 'fox', 'mouse', 'rabbit'] as const

/** Compact decree label: `bird x2, fox x1` (skips zero counts). */
export function formatDecreeSuitCounts(suits: readonly string[]): string {
  if (suits.length === 0) {
    return '—'
  }
  const counts = new Map<string, number>()
  for (const suit of suits) {
    counts.set(suit, (counts.get(suit) ?? 0) + 1)
  }
  const parts: string[] = []
  for (const suit of DECREE_SUIT_ORDER) {
    const count = counts.get(suit)
    if (count === undefined || count === 0) {
      continue
    }
    parts.push(`${suit} x${String(count)}`)
    counts.delete(suit)
  }
  for (const [suit, count] of [...counts.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    parts.push(`${suit} x${String(count)}`)
  }
  return parts.join(', ')
}

function decreeColumnsFromBoard(
  decree: EyrieBoardData['decree'],
): EyrieDecreeColumnView[] {
  return EYRIE_DECREE_COLUMNS.map((columnId) => {
    const cards = decree?.[columnId] ?? []
    return {
      columnId,
      regionId: `decree-${columnId}`,
      suits: cards.map((card) => suitForDecreeCard(card.defId)),
    }
  })
}

function isEyrieDecreeColumnId(value: string): value is EyrieDecreeColumnId {
  return (EYRIE_DECREE_COLUMNS as readonly string[]).includes(value)
}

function readActiveDecreeColumn(turnScratch: unknown): EyrieDecreeColumnId | null {
  if (typeof turnScratch !== 'object' || turnScratch === null) {
    return null
  }
  const decree = Reflect.get(turnScratch, 'decree')
  if (typeof decree !== 'object' || decree === null) {
    return null
  }
  const column = Reflect.get(decree, 'column')
  if (typeof column !== 'string' || !isEyrieDecreeColumnId(column)) {
    return null
  }
  return column
}

export const CHARACTER_BOARD_TEXTURE_KEYS = {
  marquise: GAME_ASSET_KEYS.characterBoardMarquise,
  eyrie: GAME_ASSET_KEYS.characterBoardEyrie,
} as const

export function buildFactionBoardViewModel(
  state: GameState,
  seat: number,
): FactionBoardViewModel | null {
  const player = state.players.find((entry) => entry.seat === seat)
  if (player === undefined) {
    return null
  }
  const view = buildFactionBoardViewModelFromPlayer(player)
  if (view === null || view.kind !== 'eyrie') {
    return view
  }
  return {
    ...view,
    activeDecreeColumn: readActiveDecreeColumn(state.turnScratch),
  }
}

export function buildFactionBoardViewModelFromPlayer(
  player: PlayerForBoard,
): FactionBoardViewModel | null {
  if (player.faction === 'marquise' && isMarquiseBoardData(player.board)) {
    const board = player.board
    return {
      kind: 'marquise',
      seat: player.seat,
      factionName: 'Marquise de Cat',
      victoryPoints: player.vp,
      warriors: board.supply.warriors,
      wood: board.supply.wood,
      handSize: player.hand.length,
      crafted: craftedLookup(player),
      abilities: MARQUISE_ABILITIES,
      turnCheat: MARQUISE_TURN_CHEAT,
      trackColumns: MARQUISE_BUILDING_TRACK,
      emptiedColumnCount: {
        sawmill: emptiedBuildingColumns(board.tracks.sawmill.placed),
        workshop: emptiedBuildingColumns(board.tracks.workshop.placed),
        recruiter: emptiedBuildingColumns(board.tracks.recruiter.placed),
      },
      boardTextureKey: CHARACTER_BOARD_TEXTURE_KEYS.marquise,
    }
  }

  if (player.faction === 'eyrie' && isEyrieBoardData(player.board)) {
    const board = player.board
    const leader =
      board.leader === null ? null : lookupEyrieBoardLeader(board.leader)
    return {
      kind: 'eyrie',
      seat: player.seat,
      factionName: 'Eyrie Dynasties',
      victoryPoints: player.vp,
      warriors: board.supply.warriors,
      handSize: player.hand.length,
      crafted: craftedLookup(player),
      abilities: EYRIE_ABILITIES,
      turnCheat: EYRIE_TURN_CHEAT,
      turmoilCheat: EYRIE_TURMOIL_CHEAT,
      roostTrack: EYRIE_ROOST_TRACK,
      roostsOnMap: roostsOnMapFromTrack(board.roostTrack.placed),
      leader,
      decreeColumns: decreeColumnsFromBoard(board.decree),
      activeDecreeColumn: null,
      boardTextureKey: CHARACTER_BOARD_TEXTURE_KEYS.eyrie,
    }
  }

  return null
}
