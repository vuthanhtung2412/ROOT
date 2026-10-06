import { RIVERFOLK_EXPANSION_ASSET_KEYS } from '#assets/riverfolkExpansionAssets.ts'
import type { CraftedLookup } from '#ui/factionBoardViewModel.ts'

/** Faction board view models of the Lizard Cult and the Riverfolk Company. */

export const BOARD_SUITS = ['fox', 'rabbit', 'mouse'] as const

export type BoardSuit = (typeof BOARD_SUITS)[number]

export type SuitCounts = Record<BoardSuit, number>

/** Rule: 10.3.4 — spaces of each Gardens track. */
export const LIZARD_GARDEN_TRACK_SLOT_COUNT = 5
/** Rule: 11.3.3 — spaces of each Trade Posts track. */
export const RIVERFOLK_TRADE_POST_TRACK_SLOT_COUNT = 3

export const RIVERFOLK_SERVICE_IDS = [
  'handCard',
  'riverboats',
  'mercenaries',
] as const

export type RiverfolkServiceId = (typeof RIVERFOLK_SERVICE_IDS)[number]

export type LizardBoardViewModel = {
  kind: 'lizard'
  seat: number
  factionName: string
  victoryPoints: number
  warriors: number
  handSize: number
  crafted: CraftedLookup
  acolytes: number
  /** Null until chosen in setup. */
  outcast: BoardSuit | null
  hated: boolean
  /** Gardens still on each Gardens track. */
  gardensOnTrack: SuitCounts
  /** Card definitions revealed this turn. Rule: 10.5. */
  revealedDefIds: string[]
  /** Size of the Lost Souls pile. Rule: 10.2.6. */
  lostSoulsCount: number
  boardTextureKey: string
}

export type RiverfolkBoardViewModel = {
  kind: 'riverfolk'
  seat: number
  factionName: string
  victoryPoints: number
  warriors: number
  handSize: number
  crafted: CraftedLookup
  /** Faction of each warrior in the box, in box order. */
  payments: string[]
  funds: string[]
  committed: string[]
  /** Trade posts still on each Trade Posts track. */
  tradePostsOnTrack: SuitCounts
  /** Funds committed to empty Trade Posts spaces to craft, by suit. */
  craftCommitted: Record<BoardSuit, string[]>
  serviceCosts: Record<RiverfolkServiceId, number>
  boardTextureKey: string
}

export type ExpansionBoardViewModel =
  | LizardBoardViewModel
  | RiverfolkBoardViewModel

export type ExpansionBoardPlayer = {
  seat: number
  faction: string
  vp: number
  hand: ReadonlyArray<unknown>
  board?: unknown
}

const UNKNOWN_FACTION = 'neutral'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readNumber(source: unknown, field: string): number {
  if (!isRecord(source)) return 0
  const value = source[field]
  return typeof value === 'number' ? value : 0
}

function readSuitCounts(source: unknown): SuitCounts {
  return {
    fox: readNumber(source, 'fox'),
    rabbit: readNumber(source, 'rabbit'),
    mouse: readNumber(source, 'mouse'),
  }
}

function isBoardSuit(value: unknown): value is BoardSuit {
  return BOARD_SUITS.some((suit: BoardSuit): boolean => suit === value)
}

function readDefIds(cards: unknown): string[] {
  if (!Array.isArray(cards)) return []
  const defIds: string[] = []
  for (const card of cards) {
    const defId: unknown = isRecord(card) ? card.defId : undefined
    if (typeof defId === 'string') defIds.push(defId)
  }
  return defIds
}

/** Owner seats of a fund box → faction ids (for warrior art). */
function readFundFactions(
  box: unknown,
  factions: readonly string[],
): string[] {
  if (!Array.isArray(box)) return []
  return box.map((owner: unknown): string =>
    typeof owner === 'number' ? (factions[owner] ?? UNKNOWN_FACTION) : UNKNOWN_FACTION,
  )
}

function readSupplyWarriors(board: Record<string, unknown>): number {
  return readNumber(board.supply, 'warriors')
}

function lizardViewModel(
  player: ExpansionBoardPlayer,
  board: Record<string, unknown>,
  crafted: CraftedLookup,
): LizardBoardViewModel {
  return {
    kind: 'lizard',
    seat: player.seat,
    factionName: 'Lizard Cult',
    victoryPoints: player.vp,
    warriors: readSupplyWarriors(board),
    handSize: player.hand.length,
    crafted,
    acolytes: readNumber(board, 'acolytes'),
    outcast: isBoardSuit(board.outcast) ? board.outcast : null,
    hated: board.hated === true,
    gardensOnTrack: readSuitCounts(board.gardens),
    revealedDefIds: readDefIds(board.revealed),
    lostSoulsCount: 0,
    boardTextureKey: RIVERFOLK_EXPANSION_ASSET_KEYS.characterBoardLizard,
  }
}

function riverfolkViewModel(
  player: ExpansionBoardPlayer,
  board: Record<string, unknown>,
  context: { crafted: CraftedLookup; factions: readonly string[] },
): RiverfolkBoardViewModel {
  const craftCommitted: unknown = board.craftCommitted
  const craftBox = (suit: BoardSuit): string[] =>
    readFundFactions(
      isRecord(craftCommitted) ? craftCommitted[suit] : undefined,
      context.factions,
    )
  return {
    kind: 'riverfolk',
    seat: player.seat,
    factionName: 'Riverfolk Company',
    victoryPoints: player.vp,
    warriors: readSupplyWarriors(board),
    handSize: player.hand.length,
    crafted: context.crafted,
    payments: readFundFactions(board.payments, context.factions),
    funds: readFundFactions(board.funds, context.factions),
    committed: readFundFactions(board.committed, context.factions),
    tradePostsOnTrack: readSuitCounts(board.tradePosts),
    craftCommitted: {
      fox: craftBox('fox'),
      rabbit: craftBox('rabbit'),
      mouse: craftBox('mouse'),
    },
    serviceCosts: {
      handCard: readNumber(board.serviceCosts, 'handCard'),
      riverboats: readNumber(board.serviceCosts, 'riverboats'),
      mercenaries: readNumber(board.serviceCosts, 'mercenaries'),
    },
    boardTextureKey: RIVERFOLK_EXPANSION_ASSET_KEYS.characterBoardRiverfolk,
  }
}

/** View model of a Lizard Cult or Riverfolk board; null for any other board. */
export function buildExpansionBoardViewModel(
  player: ExpansionBoardPlayer,
  context: { crafted: CraftedLookup; factions: readonly string[] },
): ExpansionBoardViewModel | null {
  const board = player.board
  if (!isRecord(board)) return null
  if (player.faction === 'lizard' && board.kind === 'lizard') {
    return lizardViewModel(player, board, context.crafted)
  }
  if (player.faction === 'riverfolk' && board.kind === 'riverfolk') {
    return riverfolkViewModel(player, board, context)
  }
  return null
}

/** Size of the Lost Souls pile kept on the deck. Rule: 10.2.6. */
export function lostSoulsCountFromDeck(deck: unknown): number {
  if (!isRecord(deck)) return 0
  const lostSouls: unknown = deck.lostSouls
  return Array.isArray(lostSouls) ? lostSouls.length : 0
}
