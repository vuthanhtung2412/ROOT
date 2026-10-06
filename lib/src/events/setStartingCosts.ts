import { actionMatchesOption } from '#actions/options.js'
import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import {
  serviceCostOptions,
  setStartingServiceCosts,
} from '#factions/riverfolk/setup.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { SetStartingCostsEvent } from '#events/types.js'

export type SetStartingCostsApply = {
  event: SetStartingCostsEvent
  action: ResolveEventAction
  actor: Seat
}

export type SetStartingCostsResolver = {
  legalActions(
    state: GameState,
    event: SetStartingCostsEvent,
    ctx: Ctx,
  ): ActionSpec[]
  apply(state: GameState, apply: SetStartingCostsApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: SetStartingCostsEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

export const setStartingCostsResolver: SetStartingCostsResolver = {
  matchesAction(_state, _event, action, _ctx) {
    if (action.type !== 'resolveEvent') return false
    return actionMatchesOption(action, serviceCostOptions())
  },

  legalActions(_state, event, _ctx) {
    return [
      {
        type: 'resolveEvent',
        actor: event.seat,
        params: { options: serviceCostOptions() },
      },
    ]
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.seat) throw new RuleError('WRONG_ACTOR', { actor })
    if (
      action.handCard === undefined ||
      action.riverboats === undefined ||
      action.mercenaries === undefined
    ) {
      throw new RuleError('MISSING_SERVICE_COST')
    }

    const pendingIndex = state.pending.indexOf(event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    // Rule: 11.3.5 — one service marker on any space of each Services track.
    setStartingServiceCosts(state, event.seat, {
      handCard: action.handCard,
      riverboats: action.riverboats,
      mercenaries: action.mercenaries,
    })

    return [{ t: 'event', event }]
  },
}
