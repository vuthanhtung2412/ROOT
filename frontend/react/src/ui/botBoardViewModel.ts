import { GAME_ASSET_KEYS, lookupCardCatalog } from '#assets/gameAssets.ts'

/**
 * Rootbotics bot boards (Mechanical Marquise 2.0, Electric Eyrie): the
 * printed board with its pieces, plus the order card and the Decree.
 */

const VIZIER_DEFINITION_ID = 'VIZIER'
const VIZIER_CARD_NAME = 'Loyal Vizier'
const BIRD_SUIT = 'bird'
const UNKNOWN_SUIT = '?'
/** Rule: Rootbotics 5.4.3 / errata board — Decree columns left to right. */
const DECREE_COLUMN_SUITS: readonly string[] = ['fox', 'mouse', 'rabbit', 'bird']
const BUILDING_TRACKS: readonly string[] = ['sawmill', 'workshop', 'recruiter']

export type BotCardView = {
  cardId: string
  name: string
  suit: string
}

type BotBoardBase = {
  seat: number
  factionName: string
  victoryPoints: number
  warriors: number
  orderCard: BotCardView | null
  craftedItems: string[]
  /** Scan of the printed bot board. */
  boardTextureKey: string
}

export type MechanicalMarquiseBoardViewModel = BotBoardBase & {
  kind: 'mechanicalMarquise'
  tracks: Array<{ building: string; onTrack: number }>
}

export type ElectricEyrieBoardViewModel = BotBoardBase & {
  kind: 'electricEyrie'
  decree: Array<{ suit: string; cards: BotCardView[] }>
  roostsOnTrack: number
}

export type BotBoardViewModel =
  | MechanicalMarquiseBoardViewModel
  | ElectricEyrieBoardViewModel

type BotPlayer = {
  seat: number
  faction: string
  vp: number
  craftedItems?: Array<string | { type: string; exhausted?: boolean }>
  board?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function numberField(record: Record<string, unknown>, field: string): number {
  const value = Reflect.get(record, field)
  return typeof value === 'number' ? value : 0
}

function cardView(value: unknown): BotCardView | null {
  if (!isRecord(value)) return null
  const cardId = Reflect.get(value, 'id')
  const defId = Reflect.get(value, 'defId')
  if (typeof cardId !== 'string' || typeof defId !== 'string') return null
  if (defId === VIZIER_DEFINITION_ID) {
    return { cardId, name: VIZIER_CARD_NAME, suit: BIRD_SUIT }
  }
  const entry = lookupCardCatalog(defId)
  return { cardId, name: entry?.name ?? defId, suit: entry?.suit ?? UNKNOWN_SUIT }
}

function cardViews(value: unknown): BotCardView[] {
  if (!Array.isArray(value)) return []
  return value
    .map(cardView)
    .filter((card: BotCardView | null): card is BotCardView => card !== null)
}

function craftedItemNames(player: BotPlayer): string[] {
  return (player.craftedItems ?? []).map(
    (item: string | { type: string; exhausted?: boolean }): string =>
      typeof item === 'string' ? item : item.type,
  )
}

function supplyWarriors(board: Record<string, unknown>): number {
  const supply = Reflect.get(board, 'supply')
  return isRecord(supply) ? numberField(supply, 'warriors') : 0
}

function trackCount(tracks: unknown, building: string): number {
  if (!isRecord(tracks)) return 0
  const track = Reflect.get(tracks, building)
  return isRecord(track) ? numberField(track, 'placed') : 0
}

/** Bot board panel of a seat; null for a faction that is not a bot. */
export function buildBotBoardViewModel(player: BotPlayer): BotBoardViewModel | null {
  const board = player.board
  if (!isRecord(board)) return null
  const base = {
    seat: player.seat,
    victoryPoints: player.vp,
    warriors: supplyWarriors(board),
    orderCard: cardView(Reflect.get(board, 'orderCard')),
    craftedItems: craftedItemNames(player),
  }
  const kind = Reflect.get(board, 'kind')
  if (kind === 'mechanicalMarquise') {
    const tracks = Reflect.get(board, 'tracks')
    return {
      ...base,
      kind,
      factionName: 'Mechanical Marquise 2.0',
      boardTextureKey: GAME_ASSET_KEYS.characterBoardMechanicalMarquise,
      tracks: BUILDING_TRACKS.map((building: string) => ({
        building,
        onTrack: trackCount(tracks, building),
      })),
    }
  }
  if (kind === 'electricEyrie') {
    const decree = Reflect.get(board, 'decree')
    const roostTrack = Reflect.get(board, 'roostTrack')
    return {
      ...base,
      kind,
      factionName: 'Electric Eyrie',
      boardTextureKey: GAME_ASSET_KEYS.characterBoardElectricEyrie,
      decree: DECREE_COLUMN_SUITS.map((suit: string) => ({
        suit,
        cards: isRecord(decree) ? cardViews(Reflect.get(decree, suit)) : [],
      })),
      roostsOnTrack: isRecord(roostTrack) ? numberField(roostTrack, 'placed') : 0,
    }
  }
  return null
}

export function isBotBoardViewModel(view: { kind: string }): view is BotBoardViewModel {
  return view.kind === 'mechanicalMarquise' || view.kind === 'electricEyrie'
}
