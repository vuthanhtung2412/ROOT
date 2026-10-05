import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import {
  boardOf,
  damageChosenItems,
  damageItems,
  damageableItemCount,
  isItemDamageChoiceRequired,
  isValidItemDamageChoice,
  undamagedItemChoices,
} from '#factions/vagabond/items.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { VagabondDamageEvent } from '#events/types.js'

export type VagabondDamageApply = {
  event: VagabondDamageEvent
  action: ResolveEventAction
  actor: Seat
}

export type VagabondDamageResolver = {
  legalActions(state: GameState, event: VagabondDamageEvent, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: VagabondDamageApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: VagabondDamageEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

export const vagabondDamageResolver: VagabondDamageResolver = {
  legalActions(state, event, _ctx) {
    const board = boardOf(state, event.seat)
    return [
      {
        type: 'resolveEvent',
        actor: event.seat,
        params: {
          vagabondItems: undamagedItemChoices(board),
          itemCount: [damageableItemCount(board, event.count)],
        },
      },
    ]
  },

  matchesAction(state, event, action, _ctx) {
    if (action.type !== 'resolveEvent' || action.items === undefined) return false
    return isValidItemDamageChoice(
      boardOf(state, event.seat),
      action.items,
      event.count,
    )
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.seat) {
      throw new RuleError('WRONG_ACTOR', { actor })
    }
    const board = boardOf(state, event.seat)
    if (
      action.items === undefined ||
      !isValidItemDamageChoice(board, action.items, event.count)
    ) {
      throw new RuleError('INVALID_ITEM_DAMAGE_CHOICE', { items: action.items })
    }
    const pendingIndex: number = state.pending.indexOf(event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)
    damageChosenItems(board, action.items)
    return [
      { t: 'event', event },
      { t: 'action', actor, action: { type: 'resolveEvent', items: action.items } },
    ]
  },
}

/**
 * Rule: 9.2.3.I Full Removal / 9.2.6 Taking Hits — damage `count` items.
 * Queues a choice for the Vagabond unless every undamaged item is damaged anyway.
 */
export function enqueueVagabondDamage(
  state: GameState,
  seat: Seat,
  count: number,
): void {
  const board = boardOf(state, seat)
  if (!isItemDamageChoiceRequired(board, count)) {
    damageItems(board, count)
    return
  }
  state.pending.push({ type: 'vagabondDamage', seat, count })
}
