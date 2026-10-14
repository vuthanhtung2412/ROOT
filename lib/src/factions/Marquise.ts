import type {
  Action,
  ActionSpec,
  OverworkChoice,
} from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import { Deck } from '#cards/Deck.js'
import { FALL } from '#map/fall.js'
import { canCraft } from '#queries/craft.js'
import { canBattle, legalBattleTargets } from '#queries/battle.js'
import { playerOf } from '#queries/seat.js'
import { craftCard, resetCraftingBuildingUsed } from '#rules/craft.js'
import { moveWarriors } from '#rules/move.js'
import { placeUpTo } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import { addVictoryPoints } from '#rules/dominance.js'
import { MARQUISE_BUILD_COST } from '#state/boards.js'
import type { GameState, Phase, Step } from '#state/types.js'
import { createTurnScratch } from '#state/turnScratch.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { openBattle } from '#events/battle.js'
import { Faction } from '#factions/Faction.js'
import {
  applyDiscard,
  craftStepLegalActions,
  handLimitLegalAction,
  validateDiscard,
  validateHandLimit,
} from '#factions/sharedTurn.js'
import {
  isMarquiseBuilding,
  placeMarquiseSetup,
} from '#factions/marquise/setup.js'
import {
  actionBudget,
  boardOf,
  buildColumn,
  buildVictoryPoints,
  canBuildAt,
  canOverwork,
  canRecruit,
  consumeAction,
  eveningDrawCards,
  legalBuildChoices,
  legalMarchMoves,
  placeBirdsongWood,
  recruiterClearings,
  sawmillClearings,
  validateMarchMoves,
} from '#factions/marquise/rules.js'
import {
  isValidWoodPayment,
  payWood,
} from '#factions/marquise/woodPayment.js'

export {
  fillMarquiseSetupTracks,
  keepCornerFor,
  legalStartingBuildingClearings,
  placeMarquiseKeepAndGarrison,
  placeMarquiseSetup,
  placeMarquiseStartingBuilding,
  startingBuildingZone,
} from '#factions/marquise/setup.js'
export {
  buildColumn,
  placeBirdsongWood,
  recruiterDrawBonus,
  trackColumnOccupied,
} from '#factions/marquise/rules.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['wood'],
  daylight: ['craft', 'actions'],
  evening: ['draw', 'discard'],
}

export class Marquise extends Faction {
  readonly id = 'marquise' as const
  readonly steps = STEPS

  setup(state: GameState, seat: Seat, _ctx: Ctx): void {
    // Direct-call path (unit tests): default NW corner. Game.start uses chooseKeep.
    placeMarquiseSetup(state, seat, FALL.corners[0])
  }

  autoActions(state: GameState, phase: Phase, step: Step): Action[] {
    const seat = state.currentSeat
    if (phase === 'birdsong' && step === 'wood') {
      if (state.turnScratch.birdsongWoodDone) return []
      if (sawmillClearings(state, seat).length === 0) return []
      if (boardOf(state, seat).supply.wood < 1) return []
      return [{ type: 'birdsongWood' }]
    }
    if (phase === 'evening' && step === 'draw') {
      if (state.turnScratch.eveningDrawDone) return []
      return [{ type: 'eveningDraw' }]
    }
    return []
  }

  legalActions(state: GameState, ctx: Ctx): ActionSpec[] {
    const seat = state.currentSeat
    const specs: ActionSpec[] = [...ctx.grantedActions()]

    if (state.phase === 'birdsong' && state.step === 'wood') {
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'daylight' && state.step === 'craft') {
      specs.push(...craftStepLegalActions(state, seat))
      return specs
    }

    if (state.phase === 'daylight' && state.step === 'actions') {
      const birdCardIds = playerOf(state, seat).hand
        .filter((handCard) => defOf(handCard).suit === 'bird')
        .map((handCard) => handCard.id)
      if (birdCardIds.length > 0) {
        specs.push({ type: 'spendBird', actor: seat, params: { cardIds: birdCardIds } })
      }

      if (actionBudget(state) > 0) {
        if (canRecruit(state, seat)) specs.push({ type: 'recruit', actor: seat })

        const marchMoves = legalMarchMoves(state, seat, ctx)
        if (marchMoves.length > 0) {
          specs.push({ type: 'march', actor: seat, params: { moves: marchMoves } })
        }

        const buildOptions = legalBuildChoices(state, seat, ctx)
        if (buildOptions.length > 0) {
          specs.push({ type: 'build', actor: seat, params: { options: buildOptions } })
        }

        const overworkOptions: OverworkChoice[] = []
        for (const clearing of sawmillClearings(state, seat)) {
          for (const handCard of playerOf(state, seat).hand) {
            if (canOverwork(state, seat, clearing, handCard.id)) {
              overworkOptions.push({ cardId: handCard.id, clearing })
            }
          }
        }
        if (overworkOptions.length > 0) {
          specs.push({ type: 'overwork', actor: seat, params: { options: overworkOptions } })
        }

        const battleTargets = legalBattleTargets(state, seat)
        if (battleTargets.length > 0) {
          specs.push({ type: 'battle', actor: seat, params: { targets: battleTargets } })
        }
      }

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

  validate(state: GameState, action: Action, ctx: Ctx): void {
    const seat = state.currentSeat

    switch (action.type) {
      case 'endPhase': {
        if (state.phase === 'evening' && state.step === 'discard') {
          validateHandLimit(state, seat)
        }
        return
      }
      case 'birdsongWood':
        if (state.phase !== 'birdsong' || state.step !== 'wood') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        return
      case 'eveningDraw':
        if (state.phase !== 'evening' || state.step !== 'draw') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        return
      case 'spendBird': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        const card = playerOf(state, seat).hand.find((c) => c.id === action.cardId)
        if (!card || defOf(card).suit !== 'bird') {
          throw new RuleError('NOT_A_BIRD', { cardId: action.cardId })
        }
        return
      }
      case 'recruit': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (actionBudget(state) < 1) throw new RuleError('NO_ACTIONS_LEFT')
        if (!canRecruit(state, seat)) throw new RuleError('CANNOT_RECRUIT')
        return
      }
      case 'march': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (actionBudget(state) < 1) throw new RuleError('NO_ACTIONS_LEFT')
        if (action.moves.length < 1 || action.moves.length > 2) {
          throw new RuleError('INVALID_MARCH', { count: action.moves.length })
        }
        validateMarchMoves(state, seat, action.moves, ctx)
        return
      }
      case 'build': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (actionBudget(state) < 1) throw new RuleError('NO_ACTIONS_LEFT')
        if (!isMarquiseBuilding(action.building)) {
          throw new RuleError('INVALID_BUILDING', { building: action.building })
        }
        if (!canBuildAt(state, { seat, clearing: action.clearing, building: action.building }, ctx)) {
          throw new RuleError('CANNOT_BUILD', { clearing: action.clearing, building: action.building })
        }
        const track = boardOf(state, seat).tracks[action.building]
        const woodCost = MARQUISE_BUILD_COST[buildColumn(track.placed)]!
        if (action.woodClearings.length !== woodCost) {
          throw new RuleError('NOT_ENOUGH_WOOD', {
            amount: woodCost,
            chosen: action.woodClearings.length,
          })
        }
        if (
          !isValidWoodPayment(
            state,
            {
              seat,
              buildClearing: action.clearing,
              woodClearings: action.woodClearings,
            },
            ctx,
          )
        ) {
          throw new RuleError('NOT_ENOUGH_WOOD', {
            woodClearings: action.woodClearings,
          })
        }
        return
      }
      case 'overwork': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (actionBudget(state) < 1) throw new RuleError('NO_ACTIONS_LEFT')
        if (!canOverwork(state, seat, action.clearing, action.cardId)) {
          throw new RuleError('CANNOT_OVERWORK', { clearing: action.clearing, cardId: action.cardId })
        }
        return
      }
      case 'craft': {
        if (state.phase !== 'daylight' || state.step !== 'craft') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        const card = playerOf(state, seat).hand.find((c) => c.id === action.cardId)
        if (!card || !canCraft(state, seat, card)) {
          throw new RuleError('CANNOT_CRAFT', { cardId: action.cardId })
        }
        return
      }
      case 'battle': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (actionBudget(state) < 1) throw new RuleError('NO_ACTIONS_LEFT')
        if (!canBattle(state, seat, action.clearing, action.defender)) {
          throw new RuleError('CANNOT_BATTLE', {
            clearing: action.clearing,
            defender: action.defender,
          })
        }
        return
      }
      case 'discard': {
        if (state.phase !== 'evening' || state.step !== 'discard') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        validateDiscard(state, seat, action.cardIds)
        return
      }
      default:
        throw new RuleError('NOT_IMPLEMENTED', { action: action.type })
    }
  }

  apply(state: GameState, action: Action, ctx: Ctx): LogEntry[] {
    const seat = state.currentSeat
    const logs: LogEntry[] = []

    switch (action.type) {
      case 'endPhase':
        return [{ t: 'action', actor: seat, action }]
      case 'birdsongWood':
        logs.push(...placeBirdsongWood(state, seat))
        state.turnScratch.birdsongWoodDone = true
        logs.push({ t: 'action', actor: seat, action })
        return logs
      case 'eveningDraw':
        logs.push(...eveningDrawCards(state, seat, ctx))
        state.turnScratch.eveningDrawDone = true
        return logs
      case 'spendBird': {
        const player = playerOf(state, seat)
        const idx = player.hand.findIndex((c) => c.id === action.cardId)
        const card = player.hand.splice(idx, 1)[0]!
        Deck.discard(state.deck, card, {
          onDominance: (c) => state.dominanceAvailable.push(c),
        })
        state.turnScratch.extraActions += 1
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'recruit': {
        consumeAction(state)
        state.turnScratch.recruited = true
        for (const clearing of recruiterClearings(state, seat)) {
          placeUpTo(state, { seat, clearing, spec: { kind: 'warrior' }, count: 1 })
        }
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'march': {
        consumeAction(state)
        for (const move of action.moves) {
          logs.push(...moveWarriors(state, { seat, from: move.from, to: move.to, count: move.count }, ctx))
        }
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'build': {
        if (!isMarquiseBuilding(action.building)) {
          throw new RuleError('INVALID_BUILDING', { building: action.building })
        }
        consumeAction(state)
        const board = boardOf(state, seat)
        const track = board.tracks[action.building]
        const column = buildColumn(track.placed)
        payWood(
          state,
          {
            seat,
            buildClearing: action.clearing,
            woodClearings: action.woodClearings,
          },
          ctx,
        )
        track.placed -= 1
        placeUpTo(state, { seat, clearing: action.clearing, spec: { kind: 'building', type: action.building }, count: 1 })
        const vp = buildVictoryPoints(action.building, column)
        if (vp > 0) {
          const scored = addVictoryPoints(state, seat, vp)
          if (scored > 0) {
            logs.push({ t: 'vp', actor: seat, delta: scored, reason: 'build' })
            ctx.emit({ s: 'vp', actor: seat, delta: scored })
          }
        }
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'overwork': {
        consumeAction(state)
        const player = playerOf(state, seat)
        const idx = player.hand.findIndex((c) => c.id === action.cardId)
        const card = player.hand.splice(idx, 1)[0]!
        Deck.discard(state.deck, card, {
          onDominance: (c) => state.dominanceAvailable.push(c),
        })
        placeUpTo(state, { seat, clearing: action.clearing, spec: { kind: 'token', type: 'wood' }, count: 1 })
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'craft':
        return craftCard(state, seat, action.cardId, ctx)
      case 'battle': {
        consumeAction(state)
        const logs = openBattle(
          state,
          { clearing: action.clearing, attacker: seat, defender: action.defender },
          ctx,
        )
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'discard': {
        applyDiscard(state, seat, action.cardIds)
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      default:
        throw new RuleError('NOT_IMPLEMENTED', { action: action.type })
    }
  }

  endTurn(state: GameState): void {
    resetCraftingBuildingUsed(state, state.currentSeat)
    state.turnScratch = createTurnScratch({ actionsLeft: 3 })
  }
}

export const MARQUISE = new Marquise()
