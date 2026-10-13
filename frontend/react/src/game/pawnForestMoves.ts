import {
  NO_STACK_SLOT,
  stackSlotIn,
  type BoardEffect,
  type BoardEffectClearing,
  type BoardEffectPiece,
  type BoardEffectState,
  type BoardMoveEffect,
  type BoardStackSlot,
} from '#game/boardEffects.ts'
import { isVagabondBoardWithForest } from '#game/forestLayout.ts'

/**
 * A Vagabond pawn slipping or moving into or out of a forest. A forest is not
 * a clearing, so a board comparison reads it as a pawn placed or removed;
 * here it becomes the move it is, from where the pawn stood to where it went.
 */

const PAWN_PIECE_KIND = 'pawn'
/** `from` / `to` of a move whose end is a forest (`fromForest` / `toForest`). */
const NO_CLEARING = -1
const FIRST_MOVE_STEP = 0

export type PawnEffectPlayer = {
  seat: number
  board?: unknown
}

/** A game state with the boards the pawns' forests are read from. */
export type PawnEffectState = BoardEffectState & {
  players: readonly PawnEffectPlayer[]
}

type PawnSpot =
  | { kind: 'clearing'; clearing: number; slot: BoardStackSlot }
  | { kind: 'forest'; forest: number }

function pawnPiece(player: PawnEffectPlayer): BoardEffectPiece {
  return {
    id: `${PAWN_PIECE_KIND}-${String(player.seat)}`,
    kind: PAWN_PIECE_KIND,
    owner: player.seat,
  }
}

function isPawnOf(piece: BoardEffectPiece, seat: number): boolean {
  return piece.kind === PAWN_PIECE_KIND && piece.owner === seat
}

/** Where a seat's pawn stands: its forest, else its clearing; null if nowhere. */
function pawnSpot(state: PawnEffectState, seat: number): PawnSpot | null {
  const player = state.players.find(
    (candidate: PawnEffectPlayer): boolean => candidate.seat === seat,
  )
  if (player === undefined) return null
  if (isVagabondBoardWithForest(player.board)) {
    return { kind: 'forest', forest: player.board.forest }
  }
  const clearing = state.clearings.findIndex(
    (candidate: BoardEffectClearing): boolean =>
      candidate.pieces.some((piece: BoardEffectPiece): boolean =>
        isPawnOf(piece, seat),
      ),
  )
  if (clearing < 0) return null
  return {
    kind: 'clearing',
    clearing,
    slot:
      stackSlotIn(state.clearings[clearing], pawnPiece(player)) ??
      NO_STACK_SLOT,
  }
}

function sameSpot(left: PawnSpot, right: PawnSpot): boolean {
  if (left.kind === 'forest') {
    return right.kind === 'forest' && right.forest === left.forest
  }
  return right.kind === 'clearing' && right.clearing === left.clearing
}

/** Character id on a Vagabond board, so the move draws the right meeple. */
function characterOf(board: unknown): string | null {
  if (typeof board !== 'object' || board === null) return null
  const character: unknown = Reflect.get(board, 'character')
  return typeof character === 'string' ? character : null
}

function pawnMove(
  player: PawnEffectPlayer,
  from: PawnSpot,
  to: PawnSpot,
): BoardMoveEffect {
  const character = characterOf(player.board)
  const move: BoardMoveEffect = {
    kind: 'move',
    from: from.kind === 'clearing' ? from.clearing : NO_CLEARING,
    to: to.kind === 'clearing' ? to.clearing : NO_CLEARING,
    step: FIRST_MOVE_STEP,
    fromSlot: from.kind === 'clearing' ? from.slot : NO_STACK_SLOT,
    toSlot: to.kind === 'clearing' ? to.slot : NO_STACK_SLOT,
    owner: player.seat,
    pieceKind: PAWN_PIECE_KIND,
    count: 1,
    // A pawn stands alone: it joins no stack, so nothing is held back.
    pieceIds: [],
    stackCount: 1,
    ...(from.kind === 'forest' ? { fromForest: from.forest } : {}),
    ...(to.kind === 'forest' ? { toForest: to.forest } : {}),
  }
  return character === null ? move : { ...move, pieceType: character }
}

/** Pawn moves with a forest at either end, between two committed states. */
export function pawnForestMovesBetween(
  previous: PawnEffectState,
  next: PawnEffectState,
): BoardMoveEffect[] {
  const moves: BoardMoveEffect[] = []
  for (const player of next.players) {
    const from = pawnSpot(previous, player.seat)
    const to = pawnSpot(next, player.seat)
    if (from === null || to === null || sameSpot(from, to)) continue
    if (from.kind === 'clearing' && to.kind === 'clearing') continue
    moves.push(pawnMove(player, from, to))
  }
  return moves
}

/**
 * The effects of an update, with every pawn that entered or left a forest
 * told as one move: its "placed" / "removed" effect gives way to the slide.
 */
export function withPawnForestMoves(
  effects: readonly BoardEffect[],
  previous: PawnEffectState | null,
  next: PawnEffectState,
): BoardEffect[] {
  if (previous === null || previous.id !== next.id) return [...effects]
  const moves = pawnForestMovesBetween(previous, next)
  if (moves.length === 0) return [...effects]
  const movedSeats = new Set<number>(
    moves.map((move: BoardMoveEffect): number => move.owner),
  )
  const kept = effects.filter(
    (effect: BoardEffect): boolean =>
      !(
        (effect.kind === 'place' || effect.kind === 'remove') &&
        effect.pieceKind === PAWN_PIECE_KIND &&
        movedSeats.has(effect.owner)
      ),
  )
  return [...moves, ...kept]
}
