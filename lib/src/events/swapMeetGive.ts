import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import type { Card } from '#cards/types.js'
import type { SwapMeetGiveEvent } from '#events/types.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'

export type SwapMeetGiveApply = {
  event: SwapMeetGiveEvent
  action: ResolveEventAction
  actor: Seat
}

export type SwapMeetGiveResolver = {
  legalActions(state: GameState, event: SwapMeetGiveEvent, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: SwapMeetGiveApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: SwapMeetGiveEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

/**
 * Swap Meet, second half: "…and then give them a card." Any card of the hand
 * may be given, the one just taken included.
 */
export const swapMeetGiveResolver: SwapMeetGiveResolver = {
  legalActions(state, event, _ctx) {
    const cardIds: string[] = playerOf(state, event.seat).hand.map(
      (handCard: Card): string => handCard.id,
    )
    return [{ type: 'resolveEvent', actor: event.seat, params: { cardIds } }]
  },

  matchesAction(state, event, action, ctx) {
    if (action.type !== 'resolveEvent' || action.cardId === undefined) return false
    const cardId: string = action.cardId
    return this.legalActions(state, event, ctx).some(
      (spec: ActionSpec): boolean => spec.params?.cardIds?.includes(cardId) ?? false,
    )
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.seat) throw new RuleError('WRONG_ACTOR', { actor })
    if (action.cardId === undefined) throw new RuleError('MISSING_SWAP_MEET_CARD')

    const giver = playerOf(state, event.seat)
    const cardIndex: number = giver.hand.findIndex(
      (handCard: Card): boolean => handCard.id === action.cardId,
    )
    if (cardIndex < 0) {
      throw new RuleError('CARD_NOT_IN_HAND', { cardId: action.cardId })
    }

    const pendingIndex: number = state.pending.findIndex(
      (pending): boolean => pending === event,
    )
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    const given: Card = giver.hand.splice(cardIndex, 1)[0]!
    playerOf(state, event.target).hand.push(given)
    return [{ t: 'event', event }]
  },
}
