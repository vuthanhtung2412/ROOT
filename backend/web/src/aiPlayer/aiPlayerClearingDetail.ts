import {
  FALL,
  openSlots,
  type ActionSpec,
  type FactionId,
  type Game,
  type GameState,
  type PlayerState,
} from '@root/lib'
import { listPlayerLegalActions } from '#view/playerView.js'

type Piece = GameState['clearings'][number]['pieces'][number]

export type FactionPieces = {
  warriors: number
  buildings: string[]
  tokens: string[]
  /** True when the Vagabond pawn stands here. */
  pawn: boolean
}

export type NeighborClearing = {
  id: number
  suit: string
  ruler: FactionId | null
}

export type ClearingDetail = {
  id: number
  suit: string
  slots: { total: number; free: number }
  /** Items still in the ruin; absent when the clearing holds no ruin. */
  ruinItems?: string[]
  ruler: FactionId | null
  /** Only factions with a piece here. */
  pieces: Partial<Record<FactionId, FactionPieces>>
  /** Clearings one move away by path. */
  adjacent: NeighborClearing[]
  /** Clearings linked by river: a move only for factions that use rivers. */
  byRiver: number[]
  /** Your legal action types that name this clearing right now. */
  legalActionsHereNow: string[]
}

function factionOfSeat(state: GameState, seat: number | null): FactionId | null {
  return (
    state.players.find((player: PlayerState): boolean => player.seat === seat)
      ?.faction ?? null
  )
}

function describePieces(pieces: readonly Piece[]): FactionPieces {
  return {
    warriors: pieces.filter((piece: Piece): boolean => piece.kind === 'warrior')
      .length,
    buildings: pieces.flatMap((piece: Piece): string[] =>
      piece.kind === 'building' ? [piece.type] : [],
    ),
    tokens: pieces.flatMap((piece: Piece): string[] =>
      piece.kind === 'token' ? [piece.type] : [],
    ),
    pawn: pieces.some((piece: Piece): boolean => piece.kind === 'pawn'),
  }
}

/** Every clearing a legal action lets the seat choose, whatever the param. */
function clearingsNamedBy(spec: ActionSpec): number[] {
  const params = spec.params
  if (params === undefined) return []
  const pairedClearings: number[] = [
    ...(params.options ?? []),
    ...(params.targets ?? []),
  ].flatMap((choice: object): number[] =>
    'clearing' in choice && typeof choice.clearing === 'number'
      ? [choice.clearing]
      : [],
  )
  return [
    ...(params.clearing ?? []),
    ...(params.clearings ?? []),
    ...(params.from ?? []),
    ...(params.to ?? []),
    ...(params.moves ?? []).flatMap((move): number[] => [move.from, move.to]),
    ...(params.vbMoves ?? []).map((move): number => move.to),
    ...pairedClearings,
  ]
}

/**
 * One clearing in full, so the model does not read it off the drawn map.
 * Everything here is on the table for all players. Null: no such clearing.
 */
export function describeClearing(
  game: Game,
  playerId: string,
  clearingId: number,
): ClearingDetail | null {
  const mapClearing = FALL.clearings[clearingId]
  const clearing = game.state.clearings[clearingId]
  if (mapClearing === undefined || clearing === undefined) return null
  const state = game.state
  const pieces: Partial<Record<FactionId, FactionPieces>> = {}
  for (const player of state.players) {
    const owned = clearing.pieces.filter(
      (piece: Piece): boolean => piece.owner === player.seat,
    )
    if (owned.length > 0) {
      pieces[player.faction] = describePieces(owned)
    }
  }
  return {
    id: clearingId,
    suit: mapClearing.suit,
    slots: { total: mapClearing.slots, free: openSlots(state, clearingId) },
    ...(clearing.ruin === undefined ? {} : { ruinItems: clearing.ruin.items }),
    ruler: factionOfSeat(state, game.rulerOf(clearingId)),
    pieces,
    adjacent: FALL.adjacent(clearingId).map(
      (neighbor: number): NeighborClearing => ({
        id: neighbor,
        suit: FALL.clearings[neighbor]?.suit ?? '',
        ruler: factionOfSeat(state, game.rulerOf(neighbor)),
      }),
    ),
    byRiver: FALL.riverClearings().filter((candidate: number): boolean =>
      FALL.isRiverAdjacent(clearingId, candidate),
    ),
    legalActionsHereNow: [
      ...new Set<string>(
        listPlayerLegalActions(game, playerId)
          .filter((spec: ActionSpec): boolean =>
            clearingsNamedBy(spec).includes(clearingId),
          )
          .map((spec: ActionSpec): string => spec.type),
      ),
    ],
  }
}
