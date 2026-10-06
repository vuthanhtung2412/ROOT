import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import {
  legalRiverfolkStartClearings,
  placeRiverfolkStartingWarrior,
} from '#factions/riverfolk/setup.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { isClearingId } from '#typeGuards.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { PlaceRiverfolkWarriorEvent } from '#events/types.js'

export type PlaceRiverfolkWarriorApply = {
  event: PlaceRiverfolkWarriorEvent
  action: ResolveEventAction
  actor: Seat
}

export type PlaceRiverfolkWarriorResolver = {
  legalActions(
    state: GameState,
    event: PlaceRiverfolkWarriorEvent,
    ctx: Ctx,
  ): ActionSpec[]
  apply(
    state: GameState,
    apply: PlaceRiverfolkWarriorApply,
    ctx: Ctx,
  ): LogEntry[]
  matchesAction(
    state: GameState,
    event: PlaceRiverfolkWarriorEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

export const placeRiverfolkWarriorResolver: PlaceRiverfolkWarriorResolver = {
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
        params: { clearing: legalRiverfolkStartClearings(state, event.seat) },
      },
    ]
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.seat) throw new RuleError('WRONG_ACTOR', { actor })
    if (action.clearing === undefined || !isClearingId(action.clearing)) {
      throw new RuleError('MISSING_RIVER_CLEARING')
    }

    // Rule: 11.3.2 — place 4 warriors in any clearings touching the river.
    placeRiverfolkStartingWarrior(state, event.seat, action.clearing)

    const pendingIndex = state.pending.indexOf(event)
    const remaining = event.remaining - 1
    if (pendingIndex >= 0) {
      if (remaining > 0) {
        state.pending.splice(pendingIndex, 1, { ...event, remaining })
      } else {
        state.pending.splice(pendingIndex, 1)
      }
    }

    return [{ t: 'event', event }]
  },
}
