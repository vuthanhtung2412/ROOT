import type { ActionSpec, BattleTargetChoice, MarchMove } from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import {
  boardOf,
  clearingHasSympathy,
  martialLawSurcharge,
  nextSympathyCost,
  pickSupportersOfSuit,
  sympatheticClearings,
} from '#factions/alliance/rules.js'
import { craftStepLegalActions, handLimitLegalAction } from '#factions/sharedTurn.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { canMove } from '#queries/move.js'
import { openSlots } from '#queries/slots.js'
import { warriors } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import type { GameState } from '#state/types.js'

function adjacentClearings(clearing: ClearingId): ClearingId[] {
  return FALL.adjacent(clearing)
}

export function allianceLegalActions(
  state: GameState,
  ctx: Ctx,
): ActionSpec[] {
  const seat = state.currentSeat
  const board = boardOf(state, seat)
  const specs: ActionSpec[] = [...ctx.grantedActions()]

  if (state.phase === 'birdsong' && state.step === 'actions') {
    // Rule: Alliance Birdsong — Revolt / Spread Sympathy (0+), then end.
    for (const clearing of sympatheticClearings(state, seat)) {
      const suit = FALL.clearings[clearing]!.suit
      if (!board.bases.includes(suit)) continue
      if (pickSupportersOfSuit(board, suit, 2) === null) continue
      if (openSlots(state, clearing) < 1) continue
      specs.push({
        type: 'revolt',
        actor: seat,
        params: { clearings: [clearing] },
      })
    }

    const sympathetic = sympatheticClearings(state, seat)
    const costBase = nextSympathyCost(board)
    if (costBase !== null) {
      const candidates: ClearingId[] =
        sympathetic.length === 0
          ? FALL.clearings.map((clearing) => clearing.id)
          : [
              ...new Set(
                sympathetic.flatMap((clearing) => adjacentClearings(clearing)),
              ),
            ].filter(
              (clearing) => !clearingHasSympathy(state, clearing, seat),
            )

      for (const clearing of candidates) {
        if (clearingHasSympathy(state, clearing, seat)) continue
        const suit = FALL.clearings[clearing]!.suit
        const cost =
          costBase + martialLawSurcharge(state, clearing, seat)
        const supporters = pickSupportersOfSuit(board, suit, cost)
        if (supporters === null) continue
        specs.push({
          type: 'spreadSympathy',
          actor: seat,
          params: {
            clearings: [clearing],
            supporterIds: supporters.map((card) => card.id),
          },
        })
      }
    }

    specs.push({ type: 'endPhase', actor: seat })
    return specs
  }

  if (state.phase === 'daylight' && state.step === 'actions') {
    specs.push(...craftStepLegalActions(state, seat).filter((spec) => spec.type === 'craft'))

    const hand = playerOf(state, seat).hand
    if (hand.length > 0) {
      specs.push({
        type: 'mobilize',
        actor: seat,
        params: { cardIds: hand.map((card) => card.id) },
      })
    }

    for (let clearing = 0; clearing < state.clearings.length; clearing++) {
      const hasBase = state.clearings[clearing]!.pieces.some(
        (piece) =>
          piece.kind === 'building' &&
          piece.type === 'base' &&
          piece.owner === seat,
      )
      if (!hasBase) continue
      const baseSuit = FALL.clearings[clearing]!.suit
      const cardIds = hand
        .filter((card) => {
          const cardSuit = defOf(card).suit
          return cardSuit === baseSuit || cardSuit === 'bird'
        })
        .map((card) => card.id)
      if (cardIds.length === 0) continue
      if (board.supply.warriors < 1) continue
      specs.push({
        type: 'train',
        actor: seat,
        params: { cardIds },
      })
    }

    specs.push({ type: 'endPhase', actor: seat })
    return specs
  }

  if (state.phase === 'evening' && state.step === 'military') {
    if (state.turnScratch.militaryOpsLeft > 0) {
      // Move
      const moves: MarchMove[] = []
      for (let from = 0; from < state.clearings.length; from++) {
        const count = warriors(state, from, seat)
        if (count < 1) continue
        for (const to of adjacentClearings(from)) {
          if (canMove(state, { seat, from, to }, ctx.hooks)) {
            moves.push({ from, to, count: 1 })
          }
        }
      }
      if (moves.length > 0) {
        specs.push({
          type: 'militaryOp',
          actor: seat,
          params: { op: ['move'], moves },
        })
      }

      // Battle
      const targets: BattleTargetChoice[] = []
      for (let clearing = 0; clearing < state.clearings.length; clearing++) {
        if (warriors(state, clearing, seat) < 1) continue
        for (const defender of enemySeatsInClearing(state, clearing, seat)) {
          targets.push({ clearing, defender })
        }
      }
      if (targets.length > 0) {
        specs.push({
          type: 'militaryOp',
          actor: seat,
          params: { op: ['battle'], targets },
        })
      }

      // Recruit at bases
      const recruitClearings: ClearingId[] = []
      for (let clearing = 0; clearing < state.clearings.length; clearing++) {
        const hasBase = state.clearings[clearing]!.pieces.some(
          (piece) =>
            piece.kind === 'building' &&
            piece.type === 'base' &&
            piece.owner === seat,
        )
        if (hasBase && board.supply.warriors > 0) {
          recruitClearings.push(clearing)
        }
      }
      if (recruitClearings.length > 0) {
        specs.push({
          type: 'militaryOp',
          actor: seat,
          params: { op: ['recruit'], clearings: recruitClearings },
        })
      }

      // Organize
      const organizeClearings: ClearingId[] = []
      for (let clearing = 0; clearing < state.clearings.length; clearing++) {
        if (clearingHasSympathy(state, clearing, seat)) continue
        if (warriors(state, clearing, seat) < 1) continue
        if (nextSympathyCost(board) === null) continue
        organizeClearings.push(clearing)
      }
      if (organizeClearings.length > 0) {
        specs.push({
          type: 'militaryOp',
          actor: seat,
          params: { op: ['organize'], clearings: organizeClearings },
        })
      }
    }
    specs.push({ type: 'endPhase', actor: seat })
    return specs
  }

  if (state.phase === 'evening' && state.step === 'draw') {
    specs.push({ type: 'endPhase', actor: seat })
    return specs
  }

  if (state.phase === 'evening' && state.step === 'discard') {
    specs.push(handLimitLegalAction(state, seat))
    return specs
  }

  return specs
}
