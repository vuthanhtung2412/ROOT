import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import {
  isServiceCost,
  setStartingServiceCost,
} from '#factions/riverfolk/setup.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { RuleError } from '#rules/RuleError.js'
import { RIVERFOLK_SERVICE_COSTS } from '#state/riverfolkBoard.js'
import type { GameState } from '#state/types.js'
import type { SetStartingCostEvent } from '#events/types.js'

export type SetStartingCostApply = {
  event: SetStartingCostEvent
  action: ResolveEventAction
  actor: Seat
}

export type SetStartingCostResolver = {
  legalActions(
    state: GameState,
    event: SetStartingCostEvent,
    ctx: Ctx,
  ): ActionSpec[]
  apply(state: GameState, apply: SetStartingCostApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: SetStartingCostEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

export const setStartingCostResolver: SetStartingCostResolver = {
  matchesAction(_state, _event, action, _ctx) {
    if (action.type !== 'resolveEvent') return false
    return action.cost !== undefined && isServiceCost(action.cost)
  },

  legalActions(_state, event, _ctx) {
    return [
      {
        type: 'resolveEvent',
        actor: event.seat,
        params: {
          services: [event.service],
          costs: [...RIVERFOLK_SERVICE_COSTS],
        },
      },
    ]
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.seat) throw new RuleError('WRONG_ACTOR', { actor })
    if (action.cost === undefined) {
      throw new RuleError('MISSING_SERVICE_COST')
    }

    const pendingIndex = state.pending.indexOf(event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    // Rule: 11.3.5 — one service marker on any space of each Services track.
    setStartingServiceCost(state, event.seat, {
      service: event.service,
      cost: action.cost,
    })

    return [{ t: 'event', event }]
  },
}
