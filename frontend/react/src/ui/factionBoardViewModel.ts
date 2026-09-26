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
} from '#assets/eyrieBoardCatalog.ts'
import { GAME_ASSET_KEYS, lookupCardCatalog } from '#assets/gameAssets.ts'
import {
  MARQUISE_ABILITIES,
  MARQUISE_BUILDING_TRACK,
  MARQUISE_TRACK_SLOT_COUNT,
  MARQUISE_TURN_CHEAT,
  type MarquiseAbilityInfo,
  type MarquiseTrackColumn,
} from '#assets/marquiseBoardCatalog.ts'
import {
  ALLIANCE_ABILITIES,
  ALLIANCE_SYMPATHY_TRACK,
  ALLIANCE_SYMPATHY_TRACK_SLOT_COUNT,
  ALLIANCE_TURN_CHEAT,
  type AllianceAbilityInfo,
  type AllianceSympathyTrackColumn,
} from '#assets/allianceBoardCatalog.ts'
import {
  THIEF_STARTING_ITEM_LABELS,
  VAGABOND_ABILITIES,
  VAGABOND_RELATIONSHIP_ALLIED_SPACE,
  VAGABOND_RELATIONSHIP_MARKER_FACTIONS,
  VAGABOND_TURN_CHEAT,
  type VagabondAbilityInfo,
} from '#assets/vagabondBoardCatalog.ts'
import type { GameState } from '#api/client.ts'

export type CraftedItemView = {
  type: string
  exhausted: boolean
  count: number
}

export type CraftedLookup = {
  items: CraftedItemView[]
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

export type AllianceBoardViewModel = {
  kind: 'alliance'
  seat: number
  factionName: string
  victoryPoints: number
  warriors: number
  officers: number
  supporters: number
  /** Top of supporters pile (last card); null if empty. */
  topSupporterDefId: string | null
  /** Suit of each supporter card (for decree-style summary). */
  supporterSuits: readonly string[]
  handSize: number
  crafted: CraftedLookup
  abilities: readonly AllianceAbilityInfo[]
  turnCheat: readonly string[]
  sympathyTrack: readonly AllianceSympathyTrackColumn[]
  /** Tokens still on track (right side); emptied = placed on map. */
  sympathyTokensOnTrack: number
  basesInSupply: readonly string[]
  boardTextureKey: string
}

/** Law 9.2.8 — marker on Allied track (0..3) or Hostile box. */
export type VagabondRelationshipMarkerView = {
  faction: string
  space: number | 'hostile'
}

export type VagabondBoardViewModel = {
  kind: 'vagabond'
  seat: number
  factionName: string
  victoryPoints: number
  warriors: number
  handSize: number
  crafted: CraftedLookup
  abilities: readonly VagabondAbilityInfo[]
  turnCheat: readonly string[]
  startingItems: readonly string[]
  satchel: Array<{ type: string; exhausted: boolean }>
  damaged: Array<{ type: string; exhausted: boolean }>
  tracks: {
    tea: Array<{ type: string; exhausted: boolean }>
    coin: Array<{ type: string; exhausted: boolean }>
    bag: Array<{ type: string; exhausted: boolean }>
  }
  relationships: VagabondRelationshipMarkerView[]
  forest: number | null
  boardTextureKey: string
}

export type FactionBoardViewModel =
  | MarquiseBoardViewModel
  | EyrieBoardViewModel
  | AllianceBoardViewModel
  | VagabondBoardViewModel

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

type AllianceSupporterCard = {
  id: string
  defId: string
}

type AllianceBoardData = {
  kind: 'alliance'
  supply: { warriors: number }
  supporters: unknown
  officers: number
  bases: string[]
  sympathyTrack: { placed: number }
}

type VagabondItemData = { type: string; exhausted: boolean }

type VagabondBoardData = {
  kind: 'vagabond'
  satchel: VagabondItemData[]
  tracks: {
    tea: VagabondItemData[]
    coin: VagabondItemData[]
    bag: VagabondItemData[]
  }
  damaged: VagabondItemData[]
  relationships?: unknown
  forest: number | null
}

function isRelationshipSpace(value: unknown): value is number | 'hostile' {
  if (value === 'hostile') {
    return true
  }
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= VAGABOND_RELATIONSHIP_ALLIED_SPACE
  )
}

/** Law 9.2.8 — one marker per non-Vagabond faction in this game. */
export function relationshipMarkersFromBoard(
  relationships: unknown,
  presentFactions: readonly string[] = VAGABOND_RELATIONSHIP_MARKER_FACTIONS,
): VagabondRelationshipMarkerView[] {
  if (typeof relationships !== 'object' || relationships === null) {
    return []
  }
  const markers: VagabondRelationshipMarkerView[] = []
  for (const faction of VAGABOND_RELATIONSHIP_MARKER_FACTIONS) {
    if (!presentFactions.includes(faction)) {
      continue
    }
    const space = Reflect.get(relationships, faction)
    if (!isRelationshipSpace(space)) {
      continue
    }
    markers.push({ faction, space })
  }
  return markers
}

type PlayerForBoard = {
  seat: number
  faction: string
  vp: number
  hand: Array<{ id: string; defId: string }>
  craftedItems?: Array<string | { type: string; exhausted?: boolean }>
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

function isAllianceSupporterCard(value: unknown): value is AllianceSupporterCard {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const id = Reflect.get(value, 'id')
  const defId = Reflect.get(value, 'defId')
  return typeof id === 'string' && typeof defId === 'string'
}

function allianceSupportersFromBoard(
  supporters: unknown,
): AllianceSupporterCard[] {
  if (!Array.isArray(supporters)) {
    return []
  }
  const cards: AllianceSupporterCard[] = []
  for (const entry of supporters) {
    if (isAllianceSupporterCard(entry)) {
      cards.push(entry)
    }
  }
  return cards
}

function isAllianceBoardData(value: unknown): value is AllianceBoardData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Reflect.get(value, 'kind') === 'alliance'
}

function isVagabondBoardData(value: unknown): value is VagabondBoardData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Reflect.get(value, 'kind') === 'vagabond'
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

function craftedItemKey(type: string, exhausted: boolean): string {
  return `${type}:${String(exhausted)}`
}

/** Group identical crafted items by type + exhausted flag. */
export function groupCraftedItems(
  craftedItems: Array<string | { type: string; exhausted?: boolean }>,
): CraftedItemView[] {
  const counts = new Map<string, CraftedItemView>()
  for (const item of craftedItems) {
    const type = typeof item === 'string' ? item : item.type
    const exhausted = typeof item === 'string' ? false : item.exhausted === true
    const key = craftedItemKey(type, exhausted)
    const existing = counts.get(key)
    if (existing !== undefined) {
      counts.set(key, { ...existing, count: existing.count + 1 })
      continue
    }
    counts.set(key, { type, exhausted, count: 1 })
  }
  return [...counts.values()]
}

function craftedLookup(player: PlayerForBoard): CraftedLookup {
  return { items: groupCraftedItems(player.craftedItems ?? []) }
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
  return EYRIE_DECREE_COLUMNS.some((columnId) => columnId === value)
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
  alliance: GAME_ASSET_KEYS.characterBoardAlliance,
  vagabond: GAME_ASSET_KEYS.characterBoardVagabond,
} as const

export function buildFactionBoardViewModel(
  state: GameState,
  seat: number,
): FactionBoardViewModel | null {
  const player = state.players.find((entry) => entry.seat === seat)
  if (player === undefined) {
    return null
  }
  const view = buildFactionBoardViewModelFromPlayer(player, state.factions)
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
  presentFactions: readonly string[] = VAGABOND_RELATIONSHIP_MARKER_FACTIONS,
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

  if (player.faction === 'alliance' && isAllianceBoardData(player.board)) {
    const board = player.board
    const supporterCards = allianceSupportersFromBoard(board.supporters)
    const topSupporter = supporterCards[supporterCards.length - 1]
    return {
      kind: 'alliance',
      seat: player.seat,
      factionName: 'Woodland Alliance',
      victoryPoints: player.vp,
      warriors: board.supply.warriors,
      officers: board.officers,
      supporters: supporterCards.length,
      topSupporterDefId:
        topSupporter === undefined ? null : topSupporter.defId,
      supporterSuits: supporterCards.map((card) => suitForDecreeCard(card.defId)),
      handSize: player.hand.length,
      crafted: craftedLookup(player),
      abilities: ALLIANCE_ABILITIES,
      turnCheat: ALLIANCE_TURN_CHEAT,
      sympathyTrack: ALLIANCE_SYMPATHY_TRACK,
      // `sympathyTrack.placed` = tokens still on the board track (same as Marquise tracks).
      sympathyTokensOnTrack: Math.min(
        ALLIANCE_SYMPATHY_TRACK_SLOT_COUNT,
        Math.max(0, board.sympathyTrack.placed),
      ),
      basesInSupply: board.bases,
      boardTextureKey: CHARACTER_BOARD_TEXTURE_KEYS.alliance,
    }
  }

  if (player.faction === 'vagabond' && isVagabondBoardData(player.board)) {
    const board = player.board
    return {
      kind: 'vagabond',
      seat: player.seat,
      factionName: 'Vagabond (Thief)',
      victoryPoints: player.vp,
      warriors: 0,
      handSize: player.hand.length,
      crafted: craftedLookup(player),
      abilities: VAGABOND_ABILITIES,
      turnCheat: VAGABOND_TURN_CHEAT,
      startingItems: [...THIEF_STARTING_ITEM_LABELS],
      satchel: board.satchel.map((item) => ({
        type: item.type,
        exhausted: item.exhausted,
      })),
      damaged: board.damaged.map((item) => ({
        type: item.type,
        exhausted: item.exhausted,
      })),
      tracks: {
        tea: board.tracks.tea.map((item) => ({
          type: item.type,
          exhausted: item.exhausted,
        })),
        coin: board.tracks.coin.map((item) => ({
          type: item.type,
          exhausted: item.exhausted,
        })),
        bag: board.tracks.bag.map((item) => ({
          type: item.type,
          exhausted: item.exhausted,
        })),
      },
      relationships: relationshipMarkersFromBoard(
        board.relationships,
        presentFactions,
      ),
      forest: board.forest,
      boardTextureKey: CHARACTER_BOARD_TEXTURE_KEYS.vagabond,
    }
  }

  return null
}
