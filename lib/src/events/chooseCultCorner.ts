import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import { legalCultCorners, placeCultStart } from '#factions/lizard/setup.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { isClearingId } from '#typeGuards.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { ChooseCultCornerEvent } from '#events/types.js'

export type ChooseCultCornerApply = {
  event: ChooseCultCornerEvent
  action: ResolveEventAction
  actor: Seat
}

export type ChooseCultCornerResolver = {
  legalActions(
    state: GameState,
    event: ChooseCultCornerEvent,
    ctx: Ctx,
  ): ActionSpec[]
  apply(state: GameState, apply: ChooseCultCornerApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: ChooseCultCornerEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

export const chooseCultCornerResolver: ChooseCultCornerResolver = {
  matchesAction(state, event, action, ctx) {
    if (action.type !== 'resolveEvent') return false
    if (action.clearing === undefined || !isClearingId(action.clearing)) return false
    return this.legalActions(state, event, ctx).some((spec) => {
      if (spec.type !== 'resolveEvent' || spec.actor !== event.seat) return false
      return spec.params?.clearing?.includes(action.clearing!) === true
    })
  },

  legalActions(state, event, _ctx) {
    return [
      {
        type: 'resolveEvent',
        actor: event.seat,
        params: { clearing: legalCultCorners(state) },
      },
    ]
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.seat) throw new RuleError('WRONG_ACTOR', { actor })
    if (action.clearing === undefined || !isClearingId(action.clearing)) {
      throw new RuleError('MISSING_CULT_CORNER')
    }

    const pendingIndex = state.pending.indexOf(event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    // Rule: 10.3.2 — warriors and garden in the corner, a warrior next door.
    placeCultStart(state, event.seat, action.clearing)

    return [{ t: 'event', event }]
  },
}
