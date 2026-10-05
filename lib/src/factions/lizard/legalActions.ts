import type { ActionOption } from '#actions/options.js'
import type { ActionSpec } from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import {
  conspiracyCost,
  gardenScoreVictoryPoints,
  lizardBoardOf,
  outcastClearings,
} from '#factions/lizard/rules.js'
import {
  craftStepLegalActions,
  handLimitLegalAction,
} from '#factions/sharedTurn.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { canMove } from '#queries/move.js'
import { warriors } from '#queries/pieces.js'
import { canPlace } from '#queries/place.js'
import { rules } from '#queries/ruler.js'
import { playerOf } from '#queries/seat.js'
import { openSlots } from '#queries/slots.js'
import type { LizardBoard } from '#state/lizardBoard.js'
import type { GameState } from '#state/types.js'

function clearingsOfSuit(suit: Suit): ClearingId[] {
  return FALL.clearings
    .filter((clearing): boolean => clearing.suit === suit)
    .map((clearing): ClearingId => clearing.id)
}

function pushOptions(
  specs: ActionSpec[],
  type: string,
  actor: Seat,
  options: ActionOption[],
): void {
  if (options.length === 0) return
  specs.push({ type, actor, params: { options } })
}

/** Rule: 10.4.3.I — battle targets in clearings where the Cult has warriors. */
function crusadeBattleOptions(
  state: GameState,
  seat: Seat,
  clearings: readonly ClearingId[],
): ActionOption[] {
  const options: ActionOption[] = []
  for (const clearing of clearings) {
    if (warriors(state, clearing, seat) < 1) continue
    for (const defender of enemySeatsInClearing(state, clearing, seat)) {
      options.push({ clearing, defender })
    }
  }
  return options
}

/** Rule: 10.4.3.I — moves of at least one warrior out of an Outcast clearing. */
function crusadeMoveOptions(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
  clearings: readonly ClearingId[],
): ActionOption[] {
  const options: ActionOption[] = []
  for (const from of clearings) {
    const available = warriors(state, from, seat)
    for (let to = 0; to < state.clearings.length; to++) {
      if (!canMove(state, { seat, from, to }, ctx.hooks)) continue
      for (let count = 1; count <= available; count++) {
        options.push({ from, to, count })
      }
    }
  }
  return options
}

/** Rule: 10.4.3.II — enemy warriors the Cult can replace with its own. */
function convertOptions(
  state: GameState,
  seat: Seat,
  board: LizardBoard,
  clearings: readonly ClearingId[],
): ActionOption[] {
  if (board.supply.warriors < 1) return []
  const options: ActionOption[] = []
  for (const clearing of clearings) {
    if (!canPlace(state, seat, clearing)) continue
    for (const target of enemySeatsInClearing(state, clearing, seat)) {
      if (warriors(state, clearing, target) < 1) continue
      options.push({ clearing, target })
    }
  }
  return options
}

/** Rule: 10.4.3.III — enemy buildings the Cult can replace with a garden. */
function sanctifyOptions(
  state: GameState,
  seat: Seat,
  board: LizardBoard,
  clearings: readonly ClearingId[],
): ActionOption[] {
  const options: ActionOption[] = []
  for (const clearing of clearings) {
    const suit = FALL.clearings[clearing]!.suit
    if (board.gardens[suit] < 1) continue
    if (!canPlace(state, seat, clearing)) continue
    const seen = new Set<string>()
    for (const piece of state.clearings[clearing]!.pieces) {
      if (piece.kind !== 'building' || piece.owner === seat) continue
      const key = `${String(piece.owner)}:${piece.type}`
      if (seen.has(key)) continue
      seen.add(key)
      options.push({ clearing, target: piece.owner, building: piece.type })
    }
  }
  return options
}

function conspiracyLegalActions(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): ActionSpec[] {
  const board = lizardBoardOf(state, seat)
  const specs: ActionSpec[] = []

  // Rule: 10.4.3.I — "and then, if you wish, initiate a battle in the destination".
  const followUp = state.turnScratch.crusadeFollowUpClearing
  if (followUp !== null) {
    pushOptions(
      specs,
      'crusadeBattle',
      seat,
      crusadeBattleOptions(state, seat, [followUp]),
    )
    specs.push({ type: 'skipCrusadeBattle', actor: seat })
    return specs
  }

  const clearings = outcastClearings(board)
  if (board.acolytes >= conspiracyCost(board, 'crusade')) {
    pushOptions(
      specs,
      'crusadeBattle',
      seat,
      crusadeBattleOptions(state, seat, clearings),
    )
    pushOptions(
      specs,
      'crusadeMove',
      seat,
      crusadeMoveOptions(state, seat, ctx, clearings),
    )
  }
  if (board.acolytes >= conspiracyCost(board, 'convert')) {
    pushOptions(
      specs,
      'convert',
      seat,
      convertOptions(state, seat, board, clearings),
    )
  }
  if (board.acolytes >= conspiracyCost(board, 'sanctify')) {
    pushOptions(
      specs,
      'sanctify',
      seat,
      sanctifyOptions(state, seat, board, clearings),
    )
  }
  specs.push({ type: 'endPhase', actor: seat })
  return specs
}

/** Rule: 10.5 — one ritual per revealed card; birds only fuel Sacrifice (10.2.2). */
function ritualLegalActions(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): ActionSpec[] {
  const board = lizardBoardOf(state, seat)
  const hand: Card[] = playerOf(state, seat).hand
  const buildOptions: ActionOption[] = []
  const recruitOptions: ActionOption[] = []
  const scoreOptions: ActionOption[] = []
  const sacrificeOptions: ActionOption[] = []

  for (const card of hand) {
    const suit = defOf(card).suit
    if (suit === 'bird') {
      if (board.supply.warriors > 0) sacrificeOptions.push({ cardId: card.id })
      continue
    }
    for (const clearing of clearingsOfSuit(suit)) {
      if (!canPlace(state, seat, clearing)) continue
      if (
        board.gardens[suit] > 0 &&
        openSlots(state, clearing) > 0 &&
        rules(state, clearing, seat, ctx.hooks)
      ) {
        buildOptions.push({ cardId: card.id, clearing })
      }
      if (board.supply.warriors > 0) {
        recruitOptions.push({ cardId: card.id, clearing })
      }
    }
    if (
      !state.turnScratch.ritualScoredSuits.includes(suit) &&
      gardenScoreVictoryPoints(board, suit) !== null
    ) {
      scoreOptions.push({ cardId: card.id })
    }
  }

  const specs: ActionSpec[] = []
  pushOptions(specs, 'ritualBuild', seat, buildOptions)
  pushOptions(specs, 'ritualRecruit', seat, recruitOptions)
  pushOptions(specs, 'ritualScore', seat, scoreOptions)
  pushOptions(specs, 'ritualSacrifice', seat, sacrificeOptions)
  specs.push({ type: 'endPhase', actor: seat })
  return specs
}

/** A building of the given owner and type in a clearing, if any. */
export function findEnemyBuilding(
  state: GameState,
  option: { clearing: ClearingId; target: Seat; building: string },
): Piece | undefined {
  return state.clearings[option.clearing]?.pieces.find(
    (piece): boolean =>
      piece.kind === 'building' &&
      piece.owner === option.target &&
      piece.type === option.building,
  )
}

export function lizardLegalActions(state: GameState, ctx: Ctx): ActionSpec[] {
  const seat = state.currentSeat
  const specs: ActionSpec[] = [...ctx.grantedActions()]

  if (state.phase === 'birdsong') {
    specs.push(...conspiracyLegalActions(state, seat, ctx))
    return specs
  }
  if (state.phase === 'daylight') {
    specs.push(...ritualLegalActions(state, seat, ctx))
    return specs
  }
  if (state.step === 'craft') {
    specs.push(...craftStepLegalActions(state, seat))
    return specs
  }
  if (state.step === 'discard') {
    specs.push(handLimitLegalAction(state, seat))
    return specs
  }
  specs.push({ type: 'endPhase', actor: seat })
  return specs
}
