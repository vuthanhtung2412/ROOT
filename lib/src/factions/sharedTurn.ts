import type { ActionSpec } from '#actions/types.js'
import { Deck } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import type { Ctx } from '#game/ctx.js'
import type { Seat } from '#pieces/types.js'
import { canCraft } from '#queries/craft.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import { HAND_LIMIT } from '#state/constants.js'
import type { GameState } from '#state/types.js'

export function craftStepLegalActions(
  state: GameState,
  seat: Seat,
): ActionSpec[] {
  const cardIds = playerOf(state, seat).hand
    .filter((card): boolean => canCraft(state, seat, card))
    .map((card): string => card.id)
  const actions: ActionSpec[] = []
  if (cardIds.length > 0) {
    actions.push({ type: 'craft', actor: seat, params: { cardIds } })
  }
  actions.push({ type: 'endPhase', actor: seat })
  return actions
}

export function handLimitLegalAction(
  state: GameState,
  seat: Seat,
): ActionSpec {
  const hand = playerOf(state, seat).hand
  if (hand.length <= HAND_LIMIT) {
    return { type: 'endPhase', actor: seat }
  }
  return {
    type: 'discard',
    actor: seat,
    params: { cardIds: hand.map((card): string => card.id) },
  }
}

export function validateHandLimit(state: GameState, seat: Seat): void {
  const handSize = playerOf(state, seat).hand.length
  if (handSize > HAND_LIMIT) {
    throw new RuleError('HAND_OVER_LIMIT', { hand: handSize })
  }
}

export function validateDiscard(
  state: GameState,
  seat: Seat,
  cardIds: string[],
): void {
  const hand = playerOf(state, seat).hand
  if (hand.length <= HAND_LIMIT) throw new RuleError('HAND_NOT_OVER_LIMIT')
  const uniqueCardIds = new Set(cardIds)
  if (uniqueCardIds.size !== cardIds.length) {
    throw new RuleError('DUPLICATE_DISCARD', { cardIds })
  }
  for (const cardId of cardIds) {
    if (!hand.some((card): boolean => card.id === cardId)) {
      throw new RuleError('CARD_NOT_IN_HAND', { cardId })
    }
  }
  if (hand.length - cardIds.length > HAND_LIMIT) {
    throw new RuleError('DISCARD_TOO_FEW', {
      hand: hand.length,
      discarded: cardIds.length,
    })
  }
  // Rule: Evening — "discard cards of your choice until you have five".
  if (hand.length - cardIds.length < HAND_LIMIT) {
    throw new RuleError('DISCARD_TOO_MANY', {
      hand: hand.length,
      discarded: cardIds.length,
    })
  }
}

export function applyDiscard(
  state: GameState,
  seat: Seat,
  cardIds: string[],
): void {
  const hand = playerOf(state, seat).hand
  for (const cardId of cardIds) {
    const cardIndex = hand.findIndex((card): boolean => card.id === cardId)
    if (cardIndex < 0) throw new RuleError('CARD_NOT_IN_HAND', { cardId })
    const card = hand.splice(cardIndex, 1)[0]!
    Deck.discard(state.deck, card, {
      onDominance: (dominanceCard: Card): void => {
        state.dominanceAvailable.push(dominanceCard)
      },
    })
  }
}

export type DrawRequest = {
  seat: Seat
  count: number
}

export function drawCards(
  state: GameState,
  request: DrawRequest,
  context: Ctx,
): number {
  const drawn = Deck.draw(state.deck, request.count, {
    shuffle: (cards: Card[]): Card[] => cards,
    onDominance: (card: Card): void => {
      state.dominanceAvailable.push(card)
    },
  })
  playerOf(state, request.seat).hand.push(...drawn)
  context.emit({ s: 'draw', actor: request.seat, count: drawn.length })
  return drawn.length
}
