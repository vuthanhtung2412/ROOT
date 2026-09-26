import type { BuildChoice, MarchMove } from '#actions/types.js'
import { matchesSuit } from '#cards/suit.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { BuildingType, Seat } from '#pieces/types.js'
import { connectedRuled } from '#queries/connected.js'
import { canMove } from '#queries/move.js'
import { canPlace } from '#queries/place.js'
import { warriors } from '#queries/pieces.js'
import { rules } from '#queries/ruler.js'
import { playerOf } from '#queries/seat.js'
import { openSlots } from '#queries/slots.js'
import { woodReachable } from '#queries/wood.js'
import { moveWarriors } from '#rules/move.js'
import { placeUpTo } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import {
  MARQUISE_BUILD_COST,
  MARQUISE_RECRUITER_DRAW_BONUS_INDICES,
  MARQUISE_RECRUITER_VP,
  MARQUISE_SAWMILL_VP,
  MARQUISE_WORKSHOP_VP,
  type MarquiseBoard,
} from '#state/boards.js'
import type { GameState } from '#state/types.js'
import { drawCards } from '#factions/sharedTurn.js'
import {
  MARQUISE_BUILDINGS,
  type MarquiseBuilding,
} from '#factions/marquise/setup.js'

export function boardOf(state: GameState, seat: Seat): MarquiseBoard {
  const board = playerOf(state, seat).board
  if (board.kind !== 'marquise') throw new RuleError('NOT_MARQUISE', { seat })
  return board
}

export function actionBudget(state: GameState): number {
  return state.turnScratch.actionsLeft + state.turnScratch.extraActions
}

export function consumeAction(state: GameState): void {
  if (state.turnScratch.extraActions > 0) {
    state.turnScratch.extraActions -= 1
    return
  }
  if (state.turnScratch.actionsLeft > 0) {
    state.turnScratch.actionsLeft -= 1
    return
  }
  throw new RuleError('NO_ACTIONS_LEFT')
}

export function buildColumn(placed: number): number {
  return 6 - placed
}

export function trackColumnOccupied(placed: number, column: number): boolean {
  if (placed <= 0) return false
  return column >= buildColumn(placed) && column <= 5
}

export function recruiterDrawBonus(board: MarquiseBoard): number {
  const placed = board.tracks.recruiter.placed
  let bonus = 0
  for (const index of MARQUISE_RECRUITER_DRAW_BONUS_INDICES) {
    if (!trackColumnOccupied(placed, index)) bonus += 1
  }
  return bonus
}

export function buildVictoryPoints(type: BuildingType, column: number): number {
  switch (type) {
    case 'sawmill':
      return MARQUISE_SAWMILL_VP[column]!
    case 'workshop':
      return MARQUISE_WORKSHOP_VP[column]!
    case 'recruiter':
      return MARQUISE_RECRUITER_VP[column]!
    default:
      throw new RuleError('INVALID_BUILDING', { type })
  }
}

interface WoodPayment {
  seat: Seat
  buildClearing: ClearingId
  amount: number
}

export function payWood(state: GameState, payment: WoodPayment, ctx: Ctx): void {
  const { seat, buildClearing, amount } = payment
  if (amount <= 0) return
  const board = boardOf(state, seat)
  const region = connectedRuled(state, seat, buildClearing, ctx.hooks)
  let remaining = amount
  for (const clearing of [...region].sort((left, right) => left - right)) {
    const clearingState = state.clearings[clearing]!
    clearingState.pieces = clearingState.pieces.filter((piece) => {
      if (remaining <= 0) return true
      if (piece.kind === 'token' && piece.type === 'wood' && piece.owner === seat) {
        remaining -= 1
        board.supply.wood += 1
        return false
      }
      return true
    })
  }
  if (remaining > 0) throw new RuleError('NOT_ENOUGH_WOOD', { amount, remaining })
}

/** Rule: 6.4 Birdsong — one wood per sawmill (multi-sawmill clearing repeats). */
export function sawmillClearings(state: GameState, seat: Seat): ClearingId[] {
  const clearings: ClearingId[] = []
  for (let clearing = 0; clearing < state.clearings.length; clearing++) {
    for (const piece of state.clearings[clearing]!.pieces) {
      if (
        piece.kind === 'building' &&
        piece.type === 'sawmill' &&
        piece.owner === seat
      ) {
        clearings.push(clearing)
      }
    }
  }
  return clearings
}

export function recruiterClearings(state: GameState, seat: Seat): ClearingId[] {
  const clearings: ClearingId[] = []
  for (let clearing = 0; clearing < state.clearings.length; clearing++) {
    const hasRecruiter = state.clearings[clearing]!.pieces.some(
      (piece) =>
        piece.kind === 'building' &&
        piece.type === 'recruiter' &&
        piece.owner === seat,
    )
    if (hasRecruiter) clearings.push(clearing)
  }
  return clearings
}

export function canRecruit(state: GameState, seat: Seat): boolean {
  if (state.turnScratch.recruited) return false
  const board = boardOf(state, seat)
  if (board.supply.warriors < 1) return false
  return recruiterClearings(state, seat).length > 0
}

interface BuildSite {
  seat: Seat
  clearing: ClearingId
  building: MarquiseBuilding
}

export function canBuildAt(state: GameState, site: BuildSite, ctx: Ctx): boolean {
  const { seat, clearing, building } = site
  if (!rules(state, clearing, seat, ctx.hooks)) return false
  if (!canPlace(state, seat, clearing)) return false
  if (openSlots(state, clearing) < 1) return false

  const board = boardOf(state, seat)
  const track = board.tracks[building]
  if (track.placed < 1) return false

  const column = buildColumn(track.placed)
  const cost = MARQUISE_BUILD_COST[column]!
  return woodReachable(state, seat, clearing, ctx.hooks) >= cost
}

export function canOverwork(
  state: GameState,
  seat: Seat,
  clearing: ClearingId,
  cardId: string,
): boolean {
  const board = boardOf(state, seat)
  if (board.supply.wood < 1) return false
  const hasSawmill = state.clearings[clearing]!.pieces.some(
    (piece) =>
      piece.kind === 'building' &&
      piece.type === 'sawmill' &&
      piece.owner === seat,
  )
  if (!hasSawmill) return false
  const card = playerOf(state, seat).hand.find((candidate) => candidate.id === cardId)
  if (!card) return false
  return matchesSuit(card, FALL.clearings[clearing]!.suit)
}

interface MarchPath {
  seat: Seat
  from: ClearingId
  to: ClearingId
}

function canMarchMove(state: GameState, path: MarchPath, ctx: Ctx): boolean {
  const { seat, from, to } = path
  return warriors(state, from, seat) > 0 && canMove(state, { seat, from, to }, ctx.hooks)
}

export function legalMarchMoves(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): MarchMove[] {
  const moves: MarchMove[] = []
  for (let from = 0; from < 12; from++) {
    const available = warriors(state, from, seat)
    if (available < 1) continue
    for (let to = 0; to < 12; to++) {
      if (!canMarchMove(state, { seat, from, to }, ctx)) continue
      for (let count = 1; count <= available; count++) {
        moves.push({ from, to, count })
      }
    }
  }
  return moves
}

export function validateMarchMoves(
  state: GameState,
  seat: Seat,
  moves: MarchMove[],
  ctx: Ctx,
): void {
  const simulated: GameState = {
    ...state,
    clearings: state.clearings.map((clearing) => ({
      pieces: [...clearing.pieces],
    })),
  }
  const silentContext: Ctx = {
    ...ctx,
    emit: (): void => {},
  }
  for (const move of moves) {
    if (move.count < 1) throw new RuleError('INVALID_MOVE_COUNT', { move })
    if (!canMarchMove(simulated, { seat, from: move.from, to: move.to }, silentContext)) {
      throw new RuleError('CANNOT_MOVE', { move })
    }
    if (move.count > warriors(simulated, move.from, seat)) {
      throw new RuleError('NOT_ENOUGH_WARRIORS', { move })
    }
    moveWarriors(
      simulated,
      { seat, from: move.from, to: move.to, count: move.count },
      silentContext,
    )
  }
}

export function legalBuildChoices(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): BuildChoice[] {
  const choices: BuildChoice[] = []
  for (let clearing = 0; clearing < 12; clearing++) {
    for (const building of MARQUISE_BUILDINGS) {
      if (canBuildAt(state, { seat, clearing, building }, ctx)) {
        choices.push({ clearing, building })
      }
    }
  }
  return choices
}

export function placeBirdsongWood(state: GameState, seat: Seat): LogEntry[] {
  const board = boardOf(state, seat)
  const logs: LogEntry[] = []
  for (const clearing of sawmillClearings(state, seat)) {
    if (board.supply.wood < 1) break
    const placed = placeUpTo(state, {
      seat,
      clearing,
      spec: { kind: 'token', type: 'wood' },
      count: 1,
    })
    if (placed > 0) {
      logs.push({
        t: 'pieces',
        clearing,
        placed: state.clearings[clearing]!.pieces.slice(-placed),
      })
    }
  }
  return logs
}

export function eveningDrawCards(state: GameState, seat: Seat, ctx: Ctx): LogEntry[] {
  const bonus = recruiterDrawBonus(boardOf(state, seat))
  const count = Math.min(3, 1 + bonus)
  drawCards(state, { seat, count }, ctx)
  return [{ t: 'action', actor: seat, action: { type: 'eveningDraw' } }]
}
