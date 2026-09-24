import type {
  ActionChoiceParams,
  ActionSpec,
  AddToDecreeCard,
  BattleTargetChoice,
  MarchMove,
} from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import {
  battleLegal,
  buildLegal,
  cardResolvable,
  ensureDecreeCursor,
  findDecreeCard,
  recruitLegal,
} from '#factions/eyrie/decree.js'
import {
  boardOf,
  cardMatchesClearing,
  fewestWarriorClearings,
  roostsOnMap,
} from '#factions/eyrie/rules.js'
import { craftStepLegalActions, handLimitLegalAction } from '#factions/sharedTurn.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { canMove } from '#queries/move.js'
import { warriors } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import { DECREE_COLUMNS } from '#state/boards.js'
import type { GameState } from '#state/types.js'

export function eyrieLegalActions(
  state: GameState,
  ctx: Ctx,
): ActionSpec[] {
  const seat = state.currentSeat
  const specs: ActionSpec[] = [...ctx.grantedActions()]

  if (state.phase === 'birdsong' && state.step === 'emergency') {
    specs.push({ type: 'endPhase', actor: seat })
    return specs
  }

  if (state.phase === 'birdsong' && state.step === 'decreeAdd') {
    const hand = playerOf(state, seat).hand
    if (hand.length > 0) {
      const options: AddToDecreeCard[] = []
      for (const handCard of hand) {
        for (const column of DECREE_COLUMNS) {
          options.push({ cardId: handCard.id, column })
        }
      }
      specs.push({
        type: 'addToDecree',
        actor: seat,
        params: {
          options,
          birdCardIds: hand
            .filter((handCard) => defOf(handCard).suit === 'bird')
            .map((handCard) => handCard.id),
        },
      })
    } else {
      specs.push({ type: 'endPhase', actor: seat })
    }
    return specs
  }

  if (state.phase === 'birdsong' && state.step === 'newRoost') {
    if (
      roostsOnMap(state, seat) === 0 &&
      boardOf(state, seat).roostTrack.placed > 0
    ) {
      specs.push({
        type: 'newRoost',
        actor: seat,
        params: { clearings: fewestWarriorClearings(state, seat) },
      })
      return specs
    }
    specs.push({ type: 'endPhase', actor: seat })
    return specs
  }

  if (state.phase === 'daylight' && state.step === 'craft') {
    specs.push(...craftStepLegalActions(state, seat))
    return specs
  }

  if (state.phase === 'daylight' && state.step === 'decree') {
    const cursor = ensureDecreeCursor(state, seat)
    if (!cursor) {
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }
    const board = boardOf(state, seat)
    let hasResolvableCard = false
    for (const cardId of cursor.remaining) {
      const card = findDecreeCard(board, cursor.column, cardId)
      if (!card) continue
      if (!cardResolvable(state, { seat, column: cursor.column, card }, ctx)) {
        continue
      }
      hasResolvableCard = true
      const params: ActionChoiceParams = {
        column: [cursor.column],
        cardIds: [cardId],
      }
      if (cursor.column === 'recruit') {
        params.clearings = Array.from(
          { length: FALL.clearings.length },
          (_, clearing) => clearing,
        ).filter((clearing) => recruitLegal(state, seat, card, clearing))
      } else if (cursor.column === 'build') {
        params.clearings = Array.from(
          { length: FALL.clearings.length },
          (_, clearing) => clearing,
        ).filter((clearing) =>
          buildLegal(state, { seat, card, clearing }, ctx),
        )
      } else if (cursor.column === 'battle') {
        const targets: BattleTargetChoice[] = []
        for (
          let clearing = 0;
          clearing < FALL.clearings.length;
          clearing++
        ) {
          for (const defender of enemySeatsInClearing(state, clearing, seat)) {
            if (battleLegal(state, { seat, card, clearing, defender })) {
              targets.push({ clearing, defender })
            }
          }
        }
        params.targets = targets
      } else if (cursor.column === 'move') {
        const moves: MarchMove[] = []
        for (let from = 0; from < FALL.clearings.length; from++) {
          if (!cardMatchesClearing(card, from)) continue
          const available = warriors(state, from, seat)
          if (available < 1) continue
          for (let to = 0; to < FALL.clearings.length; to++) {
            if (!canMove(state, { seat, from, to }, ctx.hooks)) continue
            for (let count = 1; count <= available; count++) {
              moves.push({ from, to, count })
            }
          }
        }
        params.moves = moves
      }
      specs.push({ type: 'decree', actor: seat, params })
    }
    if (!hasResolvableCard) {
      specs.push({ type: 'turmoil', actor: seat })
      return specs
    }
    return specs
  }

  if (state.phase === 'evening' && state.step === 'score') {
    specs.push({ type: 'endPhase', actor: seat })
    return specs
  }

  if (state.phase === 'evening' && state.step === 'draw') {
    if (!state.turnScratch.eveningDrawDone) {
      specs.push({ type: 'eveningDraw', actor: seat })
      return specs
    }
    specs.push({ type: 'endPhase', actor: seat })
    return specs
  }

  if (state.phase === 'evening' && state.step === 'discard') {
    specs.push(handLimitLegalAction(state, seat))
    return specs
  }

  specs.push({ type: 'endPhase', actor: seat })
  return specs
}
