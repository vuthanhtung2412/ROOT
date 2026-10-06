import { actionMatchesOption, actionOptionsOf } from '#actions/options.js'
import type { Action, ActionSpec, RiverfolkAction } from '#actions/types.js'
import { Deck } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { openBattle } from '#events/battle.js'
import { Faction } from '#factions/Faction.js'
import { payCraftCost } from '#factions/riverfolk/craft.js'
import { riverfolkLegalActions } from '#factions/riverfolk/legalActions.js'
import {
  applyProtectionism,
  commitFund,
  dividendVictoryPoints,
  gatherFunds,
  nextTradePostVictoryPoints,
  riverfolkBoardOf,
  spendFund,
} from '#factions/riverfolk/rules.js'
import { placeRiverfolkSetup } from '#factions/riverfolk/setup.js'
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
import { ruler } from '#queries/ruler.js'
import { playerOf } from '#queries/seat.js'
import { gainCraftedCard } from '#rules/craft.js'
import { addVictoryPoints } from '#rules/dominance.js'
import { moveWarriors } from '#rules/move.js'
import { placeUpTo } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import { RIVERFOLK_TRADE_POST_FUND_COST } from '#state/riverfolkBoard.js'
import { createTurnScratch } from '#state/turnScratch.js'
import type { GameState, Phase, Step } from '#state/types.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['funds'],
  daylight: ['commerce'],
  evening: ['discard', 'costs'],
}

/** Actions whose payload must be one of the spec's listed options. */
const OPTION_ACTION_TYPES: ReadonlySet<string> = new Set([
  'riverfolkMove',
  'riverfolkBattle',
  'riverfolkCraft',
  'riverfolkDraw',
  'riverfolkRecruit',
  'establishTradePost',
  'setServiceCosts',
])

/** Rule: 11.5.4 Draw — one card per committed fund. */
const CARDS_PER_DRAW_ACTION = 1

interface VictoryPointGain {
  seat: Seat
  victoryPoints: number
  reason: string
}

function scoreVictoryPoints(
  state: GameState,
  gain: VictoryPointGain,
  ctx: Ctx,
): LogEntry[] {
  const scored = addVictoryPoints(state, gain.seat, gain.victoryPoints)
  if (scored <= 0) return []
  ctx.emit({ s: 'vp', actor: gain.seat, delta: scored })
  return [{ t: 'vp', actor: gain.seat, delta: scored, reason: gain.reason }]
}

export class Riverfolk extends Faction {
  readonly id = 'riverfolk' as const
  readonly steps = STEPS

  setup(state: GameState, seat: Seat, _ctx: Ctx): void {
    placeRiverfolkSetup(state, seat)
  }

  autoActions(state: GameState, phase: Phase, _step: Step): Action[] {
    if (phase === 'birdsong' && !state.turnScratch.fundsGathered) {
      return [{ type: 'gatherFunds' }]
    }
    return []
  }

  legalActions(state: GameState, ctx: Ctx): ActionSpec[] {
    return riverfolkLegalActions(state, ctx)
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
    const spec = riverfolkLegalActions(state, ctx).find(
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
      case 'discard':
        validateDiscard(state, seat, action.cardIds)
        applyDiscard(state, seat, action.cardIds)
        return [{ t: 'action', actor: seat, action }]
      case 'gatherFunds':
      case 'riverfolkMove':
      case 'riverfolkBattle':
      case 'riverfolkCraft':
      case 'riverfolkDraw':
      case 'riverfolkRecruit':
      case 'establishTradePost':
      case 'setServiceCosts':
        return [
          ...this.applyCompanyAction(state, action, ctx),
          { t: 'action', actor: seat, action },
        ]
      default:
        throw new RuleError('UNSUPPORTED_ACTION', { type: action.type })
    }
  }

  endTurn(state: GameState): void {
    state.turnScratch = createTurnScratch()
  }

  private applyCompanyAction(
    state: GameState,
    action: RiverfolkAction,
    ctx: Ctx,
  ): LogEntry[] {
    const seat = state.currentSeat
    const board = riverfolkBoardOf(state, seat)
    switch (action.type) {
      case 'gatherFunds': {
        applyProtectionism(board, seat)
        const logs = scoreVictoryPoints(
          state,
          {
            seat,
            victoryPoints: dividendVictoryPoints(state, board),
            reason: 'dividends',
          },
          ctx,
        )
        gatherFunds(board)
        state.turnScratch.fundsGathered = true
        return logs
      }
      case 'riverfolkMove':
        commitFund(board, action.fundOwner)
        return moveWarriors(
          state,
          { seat, from: action.from, to: action.to, count: action.count },
          ctx,
        )
      case 'riverfolkBattle':
        commitFund(board, action.fundOwner)
        return openBattle(
          state,
          {
            clearing: action.clearing,
            attacker: seat,
            defender: action.defender,
          },
          ctx,
        )
      case 'riverfolkCraft':
        return this.applyCraft(state, seat, action, ctx)
      case 'riverfolkDraw':
        commitFund(board, action.fundOwner)
        drawCards(state, { seat, count: CARDS_PER_DRAW_ACTION }, ctx)
        return []
      case 'riverfolkRecruit':
        spendFund(state, board, action.fundOwner)
        placeUpTo(state, {
          seat,
          clearing: action.clearing,
          spec: { kind: 'warrior' },
          count: 1,
        })
        return []
      case 'establishTradePost':
        return this.applyEstablishTradePost(state, seat, action.clearing, ctx)
      case 'setServiceCosts':
        board.serviceCosts = {
          handCard: action.handCard,
          riverboats: action.riverboats,
          mercenaries: action.mercenaries,
        }
        return []
    }
  }

  /** Rule: 11.5.3 Craft, 11.5.3.I Export. */
  private applyCraft(
    state: GameState,
    seat: Seat,
    action: Extract<RiverfolkAction, { type: 'riverfolkCraft' }>,
    ctx: Ctx,
  ): LogEntry[] {
    const board = riverfolkBoardOf(state, seat)
    const hand = playerOf(state, seat).hand
    const cardIndex = hand.findIndex(
      (candidate: Card): boolean => candidate.id === action.cardId,
    )
    const card = hand[cardIndex]
    if (card === undefined) {
      throw new RuleError('CARD_NOT_IN_HAND', { cardId: action.cardId })
    }
    payCraftCost(board, card)
    if (!action.exportCard) return gainCraftedCard(state, seat, card, ctx)

    hand.splice(cardIndex, 1)
    Deck.discard(state.deck, card, {
      onDominance: (dominanceCard: Card): void => {
        state.dominanceAvailable.push(dominanceCard)
      },
    })
    if (board.supply.warriors > 0) {
      board.supply.warriors -= 1
      board.payments.push(seat)
    }
    return []
  }

  /** Rule: 11.5.6 Establish Trade Post with Garrison. */
  private applyEstablishTradePost(
    state: GameState,
    seat: Seat,
    clearing: ClearingId,
    ctx: Ctx,
  ): LogEntry[] {
    const board = riverfolkBoardOf(state, seat)
    const clearingRuler = ruler(state, clearing, ctx.hooks)
    if (clearingRuler === null) throw new RuleError('CLEARING_NOT_RULED', { clearing })
    for (let fund = 0; fund < RIVERFOLK_TRADE_POST_FUND_COST; fund++) {
      spendFund(state, board, clearingRuler)
    }
    const suit = FALL.clearings[clearing]!.suit
    const victoryPoints = nextTradePostVictoryPoints(board, suit)
    board.tradePosts[suit] -= 1
    placeUpTo(state, {
      seat,
      clearing,
      spec: { kind: 'token', type: 'tradePost' },
      count: 1,
    })
    placeUpTo(state, {
      seat,
      clearing,
      spec: { kind: 'warrior' },
      count: 1,
    })
    return scoreVictoryPoints(
      state,
      { seat, victoryPoints, reason: 'trade post' },
      ctx,
    )
  }
}

export const RIVERFOLK = new Riverfolk()
