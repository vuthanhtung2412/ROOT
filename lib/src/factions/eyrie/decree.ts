import type { MarchMove } from '#actions/types.js'
import type { Card } from '#cards/types.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { canBattle } from '#queries/battle.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { canMove } from '#queries/move.js'
import { canPlace } from '#queries/place.js'
import { warriors } from '#queries/pieces.js'
import { rules } from '#queries/ruler.js'
import { openSlots } from '#queries/slots.js'
import { RuleError } from '#rules/RuleError.js'
import {
  DECREE_COLUMNS,
  type DecreeColumn,
  type EyrieBoard,
} from '#state/boards.js'
import type { DecreeCursor, GameState } from '#state/types.js'
import {
  boardOf,
  cardMatchesClearing,
  roostClearings,
} from '#factions/eyrie/rules.js'

interface DecreeMoveCheck {
  seat: Seat
  card: Card
  moves: MarchMove[]
}

interface DecreeBattleCheck {
  seat: Seat
  card: Card
  clearing: ClearingId
  defender: Seat
}

interface DecreeBuildCheck {
  seat: Seat
  card: Card
  clearing: ClearingId
}

interface DecreeCardCheck {
  seat: Seat
  column: DecreeColumn
  card: Card
}

export function recruitWarriorCount(state: GameState, seat: Seat): number {
  return boardOf(state, seat).leader === 'charismatic' ? 2 : 1
}

export function recruitLegal(
  state: GameState,
  seat: Seat,
  card: Card,
  clearing: ClearingId,
): boolean {
  if (!cardMatchesClearing(card, clearing)) return false
  if (!roostClearings(state, seat).includes(clearing)) return false
  const needed = recruitWarriorCount(state, seat)
  if (boardOf(state, seat).supply.warriors < needed) return false
  return canPlace(state, seat, clearing)
}

export function moveLegal(
  state: GameState,
  check: DecreeMoveCheck,
  ctx: Ctx,
): boolean {
  const { seat, card, moves } = check
  if (moves.length < 1) return false
  const from = moves[0]!.from
  if (!cardMatchesClearing(card, from)) return false
  if (warriors(state, from, seat) < 1) return false
  for (const move of moves) {
    if (move.count < 1) return false
    if (!canMove(state, { seat, from: move.from, to: move.to }, ctx.hooks)) {
      return false
    }
    if (move.count > warriors(state, move.from, seat)) return false
  }
  return true
}

function hasAnyDecreeMove(
  state: GameState,
  seat: Seat,
  card: Card,
  ctx: Ctx,
): boolean {
  for (let from = 0; from < FALL.clearings.length; from++) {
    if (!cardMatchesClearing(card, from)) continue
    if (warriors(state, from, seat) < 1) continue
    for (let to = 0; to < FALL.clearings.length; to++) {
      if (canMove(state, { seat, from, to }, ctx.hooks)) return true
    }
  }
  return false
}

export function battleLegal(
  state: GameState,
  check: DecreeBattleCheck,
): boolean {
  const { seat, card, clearing, defender } = check
  if (!cardMatchesClearing(card, clearing)) return false
  return canBattle(state, seat, clearing, defender)
}

function hasAnyDecreeBattle(
  state: GameState,
  seat: Seat,
  card: Card,
): boolean {
  for (let clearing = 0; clearing < FALL.clearings.length; clearing++) {
    if (!cardMatchesClearing(card, clearing)) continue
    for (const defender of enemySeatsInClearing(state, clearing, seat)) {
      if (canBattle(state, seat, clearing, defender)) return true
    }
  }
  return false
}

export function buildLegal(
  state: GameState,
  check: DecreeBuildCheck,
  ctx: Ctx,
): boolean {
  const { seat, card, clearing } = check
  if (!cardMatchesClearing(card, clearing)) return false
  if (!rules(state, clearing, seat, ctx.hooks)) return false
  if (roostClearings(state, seat).includes(clearing)) return false
  if (boardOf(state, seat).roostTrack.placed < 1) return false
  if (!canPlace(state, seat, clearing)) return false
  if (openSlots(state, clearing) < 1) return false
  return true
}

function hasAnyDecreeBuild(
  state: GameState,
  seat: Seat,
  card: Card,
  ctx: Ctx,
): boolean {
  for (let clearing = 0; clearing < FALL.clearings.length; clearing++) {
    if (buildLegal(state, { seat, card, clearing }, ctx)) return true
  }
  return false
}

export function cardResolvable(
  state: GameState,
  check: DecreeCardCheck,
  ctx: Ctx,
): boolean {
  const { seat, column, card } = check
  switch (column) {
    case 'recruit':
      for (let clearing = 0; clearing < FALL.clearings.length; clearing++) {
        if (recruitLegal(state, seat, card, clearing)) return true
      }
      return false
    case 'move':
      return hasAnyDecreeMove(state, seat, card, ctx)
    case 'battle':
      return hasAnyDecreeBattle(state, seat, card)
    case 'build':
      return hasAnyDecreeBuild(state, seat, card, ctx)
  }
}

export function findDecreeCard(
  board: EyrieBoard,
  column: DecreeColumn,
  cardId: string,
): Card | undefined {
  return board.decree[column].find((card) => card.id === cardId)
}

export function ensureDecreeCursor(
  state: GameState,
  seat: Seat,
): DecreeCursor | null {
  // Rule: 7.5.2 — resolve each column once L→R; cards stay on decree until Purge.
  if (state.turnScratch.decreeDone) return null
  if (state.turnScratch.decree) return state.turnScratch.decree
  const board = boardOf(state, seat)
  for (const column of DECREE_COLUMNS) {
    if (board.decree[column].length === 0) continue
    const cursor: DecreeCursor = {
      column,
      remaining: board.decree[column].map((card) => card.id),
    }
    state.turnScratch.decree = cursor
    return cursor
  }
  state.turnScratch.decreeDone = true
  return null
}

export function advanceDecreeCursor(state: GameState, seat: Seat): void {
  const board = boardOf(state, seat)
  const cursor = state.turnScratch.decree
  if (!cursor) return
  if (cursor.remaining.length > 0) return
  const columnIndex = DECREE_COLUMNS.indexOf(cursor.column)
  for (
    let index = columnIndex + 1;
    index < DECREE_COLUMNS.length;
    index++
  ) {
    const column = DECREE_COLUMNS[index]!
    if (board.decree[column].length === 0) continue
    state.turnScratch.decree = {
      column,
      remaining: board.decree[column].map((card) => card.id),
    }
    return
  }
  state.turnScratch.decree = null
  state.turnScratch.decreeDone = true
}

export function removeDecreeCard(
  board: EyrieBoard,
  column: DecreeColumn,
  cardId: string,
): Card {
  const cardIndex = board.decree[column].findIndex(
    (card) => card.id === cardId,
  )
  if (cardIndex < 0) {
    throw new RuleError('DECREE_CARD_MISSING', { column, cardId })
  }
  return board.decree[column].splice(cardIndex, 1)[0]!
}
