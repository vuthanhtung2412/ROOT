import type { Action, ActionSpec } from '#actions/types.js'
import { Deck, defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { openBattle } from '#events/battle.js'
import { allianceLegalActions } from '#factions/alliance/legalActions.js'
import {
  addSupporter,
  allianceEveningDrawCount,
  boardOf,
  clearingHasSympathy,
  discardSupportersOverflow,
  isLegalSympathySpreadClearing,
  martialLawSurcharge,
  nextSympathyCost,
  nextSympathyVictoryPoints,
  removeSupportersByIds,
  sympatheticOfSuit,
} from '#factions/alliance/rules.js'
import { placeAllianceSetup } from '#factions/alliance/setup.js'
import { Faction } from '#factions/Faction.js'
import {
  applyDiscard,
  drawCards,
  validateDiscard,
  validateHandLimit,
} from '#factions/sharedTurn.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { Seat } from '#pieces/types.js'
import { canCraft } from '#queries/craft.js'
import { playerOf } from '#queries/seat.js'
import { craftCard, resetCraftingBuildingUsed } from '#rules/craft.js'
import { moveWarriors } from '#rules/move.js'
import { placeUpTo } from '#rules/place.js'
import { removePieces } from '#rules/remove.js'
import { RuleError } from '#rules/RuleError.js'
import { addVictoryPoints } from '#rules/dominance.js'
import type { GameState, Phase, Step } from '#state/types.js'
import { createTurnScratch } from '#state/turnScratch.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['actions'],
  daylight: ['actions'],
  evening: ['military', 'draw', 'discard'],
}

function discardCardToAvailable(state: GameState, card: Card): void {
  Deck.discard(state.deck, card, {
    onDominance: (dominanceCard) => state.dominanceAvailable.push(dominanceCard),
  })
}

export class Alliance extends Faction {
  readonly id = 'alliance' as const
  readonly steps = STEPS

  setup(state: GameState, seat: Seat, ctx: Ctx): void {
    placeAllianceSetup(state, seat, ctx)
  }

  autoActions(state: GameState, phase: Phase, step: Step): Action[] {
    if (phase === 'evening' && step === 'draw' && !state.turnScratch.eveningDrawDone) {
      return [{ type: 'eveningDraw' }]
    }
    return []
  }

  legalActions(state: GameState, ctx: Ctx): ActionSpec[] {
    return allianceLegalActions(state, ctx)
  }

  validate(state: GameState, action: Action, ctx: Ctx): void {
    const seat = state.currentSeat
    switch (action.type) {
      case 'endPhase':
        if (state.phase === 'evening' && state.step === 'discard') {
          validateHandLimit(state, seat)
        }
        return
      case 'eveningDraw':
        return
      case 'craft':
        if (!canCraft(state, seat, playerOf(state, seat).hand.find((c) => c.id === action.cardId)!)) {
          // canCraft throws via apply; soft check
        }
        return
      case 'revolt':
      case 'spreadSympathy':
      case 'mobilize':
      case 'train':
      case 'militaryOp':
      case 'discard':
        return
      default:
        throw new RuleError('UNSUPPORTED_ACTION', { type: action.type })
    }
  }

  apply(state: GameState, action: Action, ctx: Ctx): LogEntry[] {
    const seat = state.currentSeat
    const logs: LogEntry[] = []

    switch (action.type) {
      case 'endPhase':
        return []
      case 'eveningDraw': {
        state.turnScratch.eveningDrawDone = true
        const drawCount = allianceEveningDrawCount(boardOf(state, seat))
        drawCards(state, { seat, count: drawCount }, ctx)
        logs.push({
          t: 'action',
          actor: seat,
          action: { type: 'eveningDraw' },
        })
        return logs
      }
      case 'craft':
        return craftCard(state, seat, action.cardId, ctx)
      case 'discard':
        validateDiscard(state, seat, action.cardIds)
        applyDiscard(state, seat, action.cardIds)
        return [{ t: 'action', actor: seat, action }]
      case 'revolt':
        return this.applyRevolt(state, seat, action.clearing, ctx)
      case 'spreadSympathy':
        return this.applySpread(
          state,
          seat,
          action.clearing,
          action.supporterIds,
          ctx,
        )
      case 'mobilize':
        return this.applyMobilize(state, seat, action.cardId)
      case 'train':
        return this.applyTrain(state, seat, action.cardId)
      case 'militaryOp':
        return this.applyMilitaryOp(state, seat, action, ctx)
      default:
        throw new RuleError('UNSUPPORTED_ACTION', { type: action.type })
    }
  }

  endTurn(state: GameState): void {
    resetCraftingBuildingUsed(state, state.currentSeat)
    state.turnScratch = createTurnScratch()
  }

  private applyRevolt(
    state: GameState,
    seat: Seat,
    clearing: number,
    ctx: Ctx,
  ): LogEntry[] {
    // Rule: Alliance Birdsong Revolt 1–3.
    const board = boardOf(state, seat)
    const suit = FALL.clearings[clearing]!.suit
    if (!clearingHasSympathy(state, clearing, seat)) {
      throw new RuleError('NOT_SYMPATHETIC', { clearing })
    }
    if (!board.bases.includes(suit)) {
      throw new RuleError('NO_MATCHING_BASE', { suit })
    }
    const supporters = removeSupportersByIds(
      board,
      pickTwoSupporterIds(board, suit),
    )
    for (const card of supporters) {
      discardCardToAvailable(state, card)
    }

    const enemyPieceIds =
      state.clearings[clearing]?.pieces
        .filter((piece) => piece.owner !== seat)
        .map((piece) => piece.id) ?? []
    const logs = removePieces(
      state,
      { clearing, pieceIds: enemyPieceIds, scorer: seat },
      ctx,
    )

    const baseIndex = board.bases.indexOf(suit)
    board.bases.splice(baseIndex, 1)
    placeUpTo(state, {
      seat,
      clearing,
      spec: { kind: 'building', type: 'base' },
      count: 1,
    })

    const warriorCount = sympatheticOfSuit(state, seat, suit)
    placeUpTo(state, {
      seat,
      clearing,
      spec: { kind: 'warrior' },
      count: warriorCount,
    })

    if (board.supply.warriors > 0) {
      board.supply.warriors -= 1
      board.officers += 1
    }

    logs.push({
      t: 'action',
      actor: seat,
      action: { type: 'revolt', clearing },
    })
    return logs
  }

  private applySpread(
    state: GameState,
    seat: Seat,
    clearing: number,
    supporterIds: string[],
    ctx: Ctx,
  ): LogEntry[] {
    // Rule: Alliance Birdsong Spread Sympathy 1–3 + Martial Law.
    const board = boardOf(state, seat)
    if (!isLegalSympathySpreadClearing(state, seat, clearing)) {
      if (clearingHasSympathy(state, clearing, seat)) {
        throw new RuleError('ALREADY_SYMPATHETIC', { clearing })
      }
      throw new RuleError('SPREAD_NOT_ADJACENT', { clearing })
    }
    const baseCost = nextSympathyCost(board)
    if (baseCost === null) throw new RuleError('NO_SYMPATHY_TOKENS')
    const cost = baseCost + martialLawSurcharge(state, clearing, seat)
    if (supporterIds.length !== cost) {
      throw new RuleError('WRONG_SUPPORTER_COUNT', {
        need: cost,
        got: supporterIds.length,
      })
    }
    const suit = FALL.clearings[clearing]!.suit
    const removed = removeSupportersByIds(board, supporterIds)
    for (const card of removed) {
      const cardSuit = defOf(card).suit
      if (cardSuit !== suit && cardSuit !== 'bird') {
        throw new RuleError('SUPPORTER_SUIT_MISMATCH', { cardId: card.id })
      }
      discardCardToAvailable(state, card)
    }

    const vp = nextSympathyVictoryPoints(board)
    board.sympathyTrack.placed -= 1
    placeUpTo(state, {
      seat,
      clearing,
      spec: { kind: 'token', type: 'sympathy' },
      count: 1,
    })

    const logs: LogEntry[] = []
    if (vp > 0) {
      const scored = addVictoryPoints(state, seat, vp)
      if (scored > 0) {
        logs.push({ t: 'vp', actor: seat, delta: scored, reason: 'sympathy' })
        ctx.emit({ s: 'vp', actor: seat, delta: scored })
      }
    }
    logs.push({
      t: 'action',
      actor: seat,
      action: { type: 'spreadSympathy', clearing, supporterIds },
    })
    return logs
  }

  private applyMobilize(
    state: GameState,
    seat: Seat,
    cardId: string,
  ): LogEntry[] {
    const board = boardOf(state, seat)
    const hand = playerOf(state, seat).hand
    const index = hand.findIndex((card) => card.id === cardId)
    if (index < 0) throw new RuleError('CARD_NOT_IN_HAND', { cardId })
    const card = hand.splice(index, 1)[0]!
    const overflow = addSupporter(board, card)
    for (const discarded of overflow) {
      discardCardToAvailable(state, discarded)
    }
    return [{ t: 'action', actor: seat, action: { type: 'mobilize', cardId } }]
  }

  private applyTrain(
    state: GameState,
    seat: Seat,
    cardId: string,
  ): LogEntry[] {
    const board = boardOf(state, seat)
    if (board.supply.warriors < 1) throw new RuleError('NO_WARRIORS')
    const hand = playerOf(state, seat).hand
    const index = hand.findIndex((card) => card.id === cardId)
    if (index < 0) throw new RuleError('CARD_NOT_IN_HAND', { cardId })
    const card = hand[index]!
    const cardSuit = defOf(card).suit
    const hasBase = state.clearings.some((clearingState, clearingId) => {
      const baseHere = clearingState.pieces.some(
        (piece) =>
          piece.kind === 'building' &&
          piece.type === 'base' &&
          piece.owner === seat,
      )
      if (!baseHere) return false
      const baseSuit = FALL.clearings[clearingId]!.suit
      return cardSuit === 'bird' || cardSuit === baseSuit
    })
    if (!hasBase) throw new RuleError('NO_MATCHING_BASE_ON_MAP')
    hand.splice(index, 1)
    discardCardToAvailable(state, card)
    board.supply.warriors -= 1
    board.officers += 1
    return [{ t: 'action', actor: seat, action: { type: 'train', cardId } }]
  }

  private applyMilitaryOp(
    state: GameState,
    seat: Seat,
    action: Extract<Action, { type: 'militaryOp' }>,
    ctx: Ctx,
  ): LogEntry[] {
    if (state.turnScratch.militaryOpsLeft < 1) {
      throw new RuleError('NO_MILITARY_OPS')
    }
    state.turnScratch.militaryOpsLeft -= 1
    const logs: LogEntry[] = []

    switch (action.op) {
      case 'move': {
        if (
          action.from === undefined ||
          action.to === undefined ||
          action.count === undefined
        ) {
          throw new RuleError('MISSING_MOVE_PARAMS')
        }
        logs.push(
          ...moveWarriors(
            state,
            {
              seat,
              from: action.from,
              to: action.to,
              count: action.count,
            },
            ctx,
          ),
        )
        break
      }
      case 'battle': {
        if (action.clearing === undefined || action.defender === undefined) {
          throw new RuleError('MISSING_BATTLE_PARAMS')
        }
        logs.push(
          ...openBattle(state, {
            clearing: action.clearing,
            attacker: seat,
            defender: action.defender,
          }, ctx),
        )
        break
      }
      case 'recruit': {
        if (action.clearing === undefined) {
          throw new RuleError('MISSING_RECRUIT_CLEARING')
        }
        placeUpTo(state, {
          seat,
          clearing: action.clearing,
          spec: { kind: 'warrior' },
          count: 1,
        })
        break
      }
      case 'organize': {
        if (action.clearing === undefined) {
          throw new RuleError('MISSING_ORGANIZE_CLEARING')
        }
        const clearing = action.clearing
        if (clearingHasSympathy(state, clearing, seat)) {
          throw new RuleError('ALREADY_SYMPATHETIC', { clearing })
        }
        const warrior = state.clearings[clearing]?.pieces.find(
          (piece) => piece.kind === 'warrior' && piece.owner === seat,
        )
        if (warrior === undefined) throw new RuleError('NO_WARRIOR')
        logs.push(
          ...removePieces(
            state,
            { clearing, pieceIds: [warrior.id], scorer: seat },
            ctx,
          ),
        )
        const board = boardOf(state, seat)
        const vp = nextSympathyVictoryPoints(board)
        if (nextSympathyCost(board) === null) {
          throw new RuleError('NO_SYMPATHY_TOKENS')
        }
        board.sympathyTrack.placed -= 1
        placeUpTo(state, {
          seat,
          clearing,
          spec: { kind: 'token', type: 'sympathy' },
          count: 1,
        })
        if (vp > 0) {
          const scored = addVictoryPoints(state, seat, vp)
          if (scored > 0) {
            logs.push({ t: 'vp', actor: seat, delta: scored, reason: 'organize' })
            ctx.emit({ s: 'vp', actor: seat, delta: scored })
          }
        }
        break
      }
    }

    logs.push({ t: 'action', actor: seat, action })
    return logs
  }
}

function pickTwoSupporterIds(
  board: ReturnType<typeof boardOf>,
  suit: import('#map/types.js').Suit,
): string[] {
  const matching = board.supporters.filter((card) => {
    const cardSuit = defOf(card).suit
    return cardSuit === suit || cardSuit === 'bird'
  })
  if (matching.length < 2) throw new RuleError('NOT_ENOUGH_SUPPORTERS')
  return [matching[0]!.id, matching[1]!.id]
}

export const ALLIANCE = new Alliance()

export { discardSupportersOverflow }
