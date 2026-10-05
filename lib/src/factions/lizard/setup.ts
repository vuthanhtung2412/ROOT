import { lizardBoardOf } from '#factions/lizard/rules.js'
import { FALL } from '#map/fall.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { placeUpTo } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import { LIZARD_STARTING_CORNER_WARRIORS } from '#state/lizardBoard.js'
import type { GameState } from '#state/types.js'

/** Rule: 10.3.2 — one warrior in each clearing adjacent to the starting corner. */
const LIZARD_ADJACENT_STARTING_WARRIORS = 1

/** A piece that marks a corner as some player's starting corner clearing. */
function isStartingCornerPiece(piece: Piece): boolean {
  if (piece.kind === 'token') return piece.type === 'keep'
  if (piece.kind === 'building') {
    return piece.type === 'roost' || piece.type === 'garden'
  }
  return false
}

function startingCornersTaken(state: GameState): ClearingId[] {
  return FALL.corners.filter((corner: ClearingId): boolean =>
    state.clearings[corner]!.pieces.some(isStartingCornerPiece),
  )
}

/**
 * Rule: 10.3.2 — a corner that is not another player's starting corner and,
 * if possible, diagonally opposite from a starting corner.
 */
export function legalCultCorners(state: GameState): ClearingId[] {
  const taken = startingCornersTaken(state)
  const free = FALL.corners.filter(
    (corner: ClearingId): boolean => !taken.includes(corner),
  )
  const opposite = free.filter((corner: ClearingId): boolean =>
    taken.includes(FALL.opposite(corner)),
  )
  return opposite.length > 0 ? opposite : free
}

/** Rule: 10.3.2 + 10.3.4 — warriors and the first garden; the rest stay on tracks. */
export function placeCultStart(
  state: GameState,
  seat: Seat,
  corner: ClearingId,
): void {
  if (!legalCultCorners(state).includes(corner)) {
    throw new RuleError('ILLEGAL_CULT_CORNER', { clearing: corner })
  }
  const board = lizardBoardOf(state, seat)
  const suit = FALL.clearings[corner]!.suit
  placeUpTo(state, {
    seat,
    clearing: corner,
    spec: { kind: 'warrior' },
    count: LIZARD_STARTING_CORNER_WARRIORS,
  })
  const gardensPlaced = placeUpTo(state, {
    seat,
    clearing: corner,
    spec: { kind: 'building', type: 'garden' },
    count: 1,
  })
  board.gardens[suit] -= gardensPlaced
  for (const adjacent of FALL.adjacent(corner)) {
    placeUpTo(state, {
      seat,
      clearing: adjacent,
      spec: { kind: 'warrior' },
      count: LIZARD_ADJACENT_STARTING_WARRIORS,
    })
  }
}

/** Rule: 10.3.3 — place the outcast marker, Outcast side up. */
export function chooseStartingOutcast(
  state: GameState,
  seat: Seat,
  suit: Suit,
): void {
  const board = lizardBoardOf(state, seat)
  board.outcast = suit
  board.hated = false
}
