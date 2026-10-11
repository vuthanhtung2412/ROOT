import { actionMatchesOption, actionOptionsOf } from '#actions/options.js'
import type { Action, ActionSpec, LizardAction } from '#actions/types.js'
import { Deck, defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { openBattle } from '#events/battle.js'
import { Faction } from '#factions/Faction.js'
import {
  findEnemyBuilding,
  lizardLegalActions,
} from '#factions/lizard/legalActions.js'
import {
  adjustOutcast,
  conspiracyCost,
  gardenScoreVictoryPoints,
  lizardBoardOf,
  lizardEveningDrawCount,
  spendAcolytes,
} from '#factions/lizard/rules.js'
import {
  applyDiscard,
  drawCards,
  validateDiscard,
  validateHandLimit,
} from '#factions/sharedTurn.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { warriors } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import { craftCard, resetCraftingBuildingUsed } from '#rules/craft.js'
import { addVictoryPoints } from '#rules/dominance.js'
import { moveWarriors } from '#rules/move.js'
import { placeUpTo } from '#rules/place.js'
import { removePieces } from '#rules/remove.js'
import { RuleError } from '#rules/RuleError.js'
import type { LizardConspiracy } from '#state/lizardBoard.js'
import { createTurnScratch } from '#state/turnScratch.js'
import type { GameState, Phase, Step } from '#state/types.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['conspiracies'],
  daylight: ['rituals'],
  evening: ['craft', 'draw', 'discard'],
}

/** Actions whose payload must be one of the spec's listed options. */
const OPTION_ACTION_TYPES: ReadonlySet<string> = new Set([
  'crusadeBattle',
  'crusadeMove',
  'convert',
  'sanctify',
  'ritualBuild',
  'ritualRecruit',
  'ritualScore',
  'ritualSacrifice',
])

function takeCardFromHand(state: GameState, seat: Seat, cardId: string): Card {
  const hand = playerOf(state, seat).hand
  const cardIndex = hand.findIndex((card: Card): boolean => card.id === cardId)
  if (cardIndex < 0) throw new RuleError('CARD_NOT_IN_HAND', { cardId })
  return hand.splice(cardIndex, 1)[0]!
}

/** Rule: 10.5 — a revealed card sits in the play area until Evening. */
function revealCard(state: GameState, seat: Seat, cardId: string): Card {
  const card = takeCardFromHand(state, seat, cardId)
  lizardBoardOf(state, seat).revealed.push(card)
  return card
}

function spendForConspiracy(
  state: GameState,
  seat: Seat,
  conspiracy: LizardConspiracy,
): void {
  const board = lizardBoardOf(state, seat)
  spendAcolytes(board, conspiracyCost(board, conspiracy))
}

export class Lizard extends Faction {
  readonly id = 'lizard' as const
  readonly steps = STEPS

  /** Game.start places the Cult through chooseCultCorner / chooseOutcast. */
  setup(_state: GameState, _seat: Seat, _ctx: Ctx): void {}

  autoActions(state: GameState, phase: Phase, step: Step): Action[] {
    if (phase === 'birdsong' && !state.turnScratch.outcastAdjusted) {
      return [{ type: 'adjustOutcast' }]
    }
    if (phase === 'evening' && step === 'craft') {
      const revealed = lizardBoardOf(state, state.currentSeat).revealed
      if (revealed.length > 0) return [{ type: 'returnRevealed' }]
    }
    if (phase === 'evening' && step === 'draw') {
      if (!state.turnScratch.eveningDrawDone) return [{ type: 'eveningDraw' }]
    }
    return []
  }

  legalActions(state: GameState, ctx: Ctx): ActionSpec[] {
    return lizardLegalActions(state, ctx)
  }

  validate(state: GameState, action: Action, ctx: Ctx): void {
    const seat = state.currentSeat
    if (action.type === 'endPhase') {
      if (state.phase === 'evening' && state.step === 'discard') {
        validateHandLimit(state, seat)
      }
      return
    }
    if (!OPTION_ACTION_TYPES.has(action.type)) return
    const spec = lizardLegalActions(state, ctx).find(
      (candidate: ActionSpec): boolean => candidate.type === action.type,
    )
    const options = actionOptionsOf(spec?.params?.options)
    if (!actionMatchesOption(action, options)) {
      throw new RuleError('ILLEGAL_ACTION', { action })
    }
  }

  apply(state: GameState, action: Action, ctx: Ctx): LogEntry[] {
    const seat = state.currentSeat
    switch (action.type) {
      case 'endPhase':
        return []
      case 'craft':
        return craftCard(state, seat, action.cardId, ctx)
      case 'discard':
        validateDiscard(state, seat, action.cardIds)
        applyDiscard(state, seat, action.cardIds)
        return [{ t: 'action', actor: seat, action }]
      case 'eveningDraw': {
        state.turnScratch.eveningDrawDone = true
        const count = lizardEveningDrawCount(lizardBoardOf(state, seat))
        drawCards(state, { seat, count }, ctx)
        return [{ t: 'action', actor: seat, action }]
      }
      case 'adjustOutcast':
      case 'crusadeBattle':
      case 'crusadeMove':
      case 'skipCrusadeBattle':
      case 'convert':
      case 'sanctify':
      case 'ritualBuild':
      case 'ritualRecruit':
      case 'ritualScore':
      case 'ritualSacrifice':
      case 'returnRevealed':
        return [
          ...this.applyCultAction(state, action, ctx),
          { t: 'action', actor: seat, action },
        ]
      default:
        throw new RuleError('UNSUPPORTED_ACTION', { type: action.type })
    }
  }

  endTurn(state: GameState): void {
    resetCraftingBuildingUsed(state, state.currentSeat)
    state.turnScratch = createTurnScratch()
  }

  private applyCultAction(
    state: GameState,
    action: LizardAction,
    ctx: Ctx,
  ): LogEntry[] {
    const seat = state.currentSeat
    const board = lizardBoardOf(state, seat)
    switch (action.type) {
      case 'adjustOutcast':
        adjustOutcast(state, seat)
        state.turnScratch.outcastAdjusted = true
        return []
      case 'crusadeBattle': {
        if (state.turnScratch.crusadeFollowUpClearing === null) {
          spendForConspiracy(state, seat, 'crusade')
        }
        state.turnScratch.crusadeFollowUpClearing = null
        return openBattle(
          state,
          {
            clearing: action.clearing,
            attacker: seat,
            defender: action.defender,
          },
          ctx,
        )
      }
      case 'crusadeMove': {
        spendForConspiracy(state, seat, 'crusade')
        const logs = moveWarriors(
          state,
          { seat, from: action.from, to: action.to, count: action.count },
          ctx,
        )
        if (this.canBattleAfterCrusadeMove(state, seat, action.to)) {
          state.turnScratch.crusadeFollowUpClearing = action.to
        }
        return logs
      }
      case 'skipCrusadeBattle':
        state.turnScratch.crusadeFollowUpClearing = null
        return []
      case 'convert': {
        spendForConspiracy(state, seat, 'convert')
        const warrior = state.clearings[action.clearing]?.pieces.find(
          (piece): boolean =>
            piece.kind === 'warrior' && piece.owner === action.target,
        )
        if (warrior === undefined) throw new RuleError('NO_WARRIOR')
        const logs = removePieces(
          state,
          {
            clearing: action.clearing,
            pieceIds: [warrior.id],
            scorer: seat,
            // Rule: G.1.21 Replace — not a removal for Coffin Makers.
            options: { replaced: true },
          },
          ctx,
        )
        placeUpTo(state, {
          seat,
          clearing: action.clearing,
          spec: { kind: 'warrior' },
          count: 1,
        })
        return logs
      }
      case 'sanctify': {
        spendForConspiracy(state, seat, 'sanctify')
        const building = findEnemyBuilding(state, action)
        if (building === undefined) throw new RuleError('NO_BUILDING')
        const logs = removePieces(
          state,
          { clearing: action.clearing, pieceIds: [building.id], scorer: seat },
          ctx,
        )
        this.placeGarden(state, seat, action.clearing)
        return logs
      }
      case 'ritualBuild':
        revealCard(state, seat, action.cardId)
        this.placeGarden(state, seat, action.clearing)
        return []
      case 'ritualRecruit':
        revealCard(state, seat, action.cardId)
        placeUpTo(state, {
          seat,
          clearing: action.clearing,
          spec: { kind: 'warrior' },
          count: 1,
        })
        return []
      case 'ritualScore':
        return this.applyRitualScore(state, seat, action.cardId, ctx)
      case 'ritualSacrifice':
        revealCard(state, seat, action.cardId)
        if (board.supply.warriors < 1) throw new RuleError('NO_WARRIORS')
        board.supply.warriors -= 1
        board.acolytes += 1
        return []
      case 'returnRevealed':
        playerOf(state, seat).hand.push(...board.revealed)
        board.revealed = []
        return []
    }
  }

  private canBattleAfterCrusadeMove(
    state: GameState,
    seat: Seat,
    clearing: ClearingId,
  ): boolean {
    return (
      warriors(state, clearing, seat) > 0 &&
      enemySeatsInClearing(state, clearing, seat).length > 0
    )
  }

  private placeGarden(state: GameState, seat: Seat, clearing: ClearingId): void {
    const board = lizardBoardOf(state, seat)
    const suit = FALL.clearings[clearing]!.suit
    const placed = placeUpTo(state, {
      seat,
      clearing,
      spec: { kind: 'building', type: 'garden' },
      count: 1,
    })
    board.gardens[suit] -= placed
  }

  /** Rule: 10.5.3 Score — the card is spent (Lost Souls), not revealed. */
  private applyRitualScore(
    state: GameState,
    seat: Seat,
    cardId: string,
    ctx: Ctx,
  ): LogEntry[] {
    const board = lizardBoardOf(state, seat)
    const card = takeCardFromHand(state, seat, cardId)
    const suit = defOf(card).suit
    if (suit === 'bird') throw new RuleError('BIRD_NOT_WILD_FOR_RITUAL', { cardId })
    const victoryPoints = gardenScoreVictoryPoints(board, suit)
    if (victoryPoints === null) throw new RuleError('NO_GARDEN_SPACE', { suit })
    Deck.discard(state.deck, card, {
      onDominance: (dominanceCard: Card): void => {
        state.dominanceAvailable.push(dominanceCard)
      },
    })
    state.turnScratch.ritualScoredSuits.push(suit)
    const scored = addVictoryPoints(state, seat, victoryPoints)
    if (scored <= 0) return []
    ctx.emit({ s: 'vp', actor: seat, delta: scored })
    return [{ t: 'vp', actor: seat, delta: scored, reason: 'ritual score' }]
  }
}

export const LIZARD = new Lizard()
