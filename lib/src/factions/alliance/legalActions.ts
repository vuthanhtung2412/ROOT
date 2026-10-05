import type { ActionSpec, BattleTargetChoice, MarchMove, RevoltChoice } from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import {
  boardOf,
  canPlaceBaseAfterRevolt,
  clearingHasSympathy,
  isLegalSympathySpreadClearing,
  martialLawSurcharge,
  matchingSupporterCombinations,
  matchingSupporterPairIds,
  nextSympathyCost,
  sympatheticClearings,
} from '#factions/alliance/rules.js'
import { craftStepLegalActions, handLimitLegalAction } from '#factions/sharedTurn.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { canMove } from '#queries/move.js'
import { warriors } from '#queries/pieces.js'
import { canPlace } from '#queries/place.js'
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

  // Rule: 8.4 Birdsong — all Revolts, then all Spreads (ordered steps).
  if (state.phase === 'birdsong' && state.step === 'revolt') {
    const options: RevoltChoice[] = []
    for (const clearing of sympatheticClearings(state, seat)) {
      const suit = FALL.clearings[clearing]!.suit
      if (!board.bases.includes(suit)) continue
      if (!canPlaceBaseAfterRevolt(state, clearing, seat)) continue
      for (const supporterIds of matchingSupporterPairIds(board, suit)) {
        options.push({ clearing, supporterIds })
      }
    }
    if (options.length > 0) {
      specs.push({
        type: 'revolt',
        actor: seat,
        params: { options },
      })
    }
    specs.push({ type: 'endPhase', actor: seat })
    return specs
  }

  if (state.phase === 'birdsong' && state.step === 'spread') {
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
            ]

      // Paired clearing × supporter spend (like revolt) so tray collapse
      // cannot union unrelated supporterIds across clearings.
      const options: RevoltChoice[] = []
      for (const clearing of candidates) {
        if (!isLegalSympathySpreadClearing(state, seat, clearing)) continue
        const suit = FALL.clearings[clearing]!.suit
        const cost =
          costBase + martialLawSurcharge(state, clearing, seat)
        for (const supporterIds of matchingSupporterCombinations(
          board,
          suit,
          cost,
        )) {
          options.push({ clearing, supporterIds })
        }
      }
      if (options.length > 0) {
        specs.push({
          type: 'spreadSympathy',
          actor: seat,
          params: { options },
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
      // Move — Rule: 8.6.1.I — one move of any warrior count.
      const moves: MarchMove[] = []
      for (let from = 0; from < state.clearings.length; from++) {
        const available = warriors(state, from, seat)
        if (available < 1) continue
        for (const to of adjacentClearings(from)) {
          if (canMove(state, { seat, from, to }, ctx.hooks)) {
            for (let count = 1; count <= available; count++) {
              moves.push({ from, to, count })
            }
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

      // Organize — Rule: 6.2.2 Keep blocks placing sympathy.
      const organizeClearings: ClearingId[] = []
      for (let clearing = 0; clearing < state.clearings.length; clearing++) {
        if (clearingHasSympathy(state, clearing, seat)) continue
        if (warriors(state, clearing, seat) < 1) continue
        if (nextSympathyCost(board) === null) continue
        if (!canPlace(state, seat, clearing)) continue
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
