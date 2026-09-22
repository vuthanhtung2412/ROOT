import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import { placeMarquiseKeepAndGarrison } from '#factions/Marquise.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { isClearingId } from '#typeGuards.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { ChooseKeepEvent } from '#events/types.js'

export type ChooseKeepApply = {
  event: ChooseKeepEvent
  action: ResolveEventAction
  actor: Seat
}

export type ChooseKeepResolver = {
  legalActions(state: GameState, event: ChooseKeepEvent, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: ChooseKeepApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: ChooseKeepEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

function isCornerClearing(clearing: ClearingId): boolean {
  return FALL.corners.some((corner) => corner === clearing)
}

export const chooseKeepResolver: ChooseKeepResolver = {
  matchesAction(state, event, action, ctx) {
    if (action.type !== 'resolveEvent') return false
    if (action.clearing === undefined || !isClearingId(action.clearing)) return false
    return this.legalActions(state, event, ctx).some((spec) => {
      if (spec.type !== 'resolveEvent' || spec.actor !== event.seat) return false
      return spec.params?.clearing?.includes(action.clearing!) === true
    })
  },

  legalActions(_state, event, _ctx) {
    return [
      {
        type: 'resolveEvent',
        actor: event.seat,
        params: { clearing: [...FALL.corners] },
      },
    ]
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.seat) throw new RuleError('WRONG_ACTOR', { actor })
    if (action.clearing === undefined || !isClearingId(action.clearing)) {
      throw new RuleError('MISSING_KEEP_CLEARING')
    }
    if (!isCornerClearing(action.clearing)) {
      throw new RuleError('NOT_CORNER', { clearing: action.clearing })
    }

    const pendingIndex = state.pending.indexOf(event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    // Rule: Marquise > Setup 2–3 — keep + garrison; buildings via placeStartingBuilding.
    placeMarquiseKeepAndGarrison(state, event.seat, action.clearing)
    state.pending.push({
      type: 'placeStartingBuilding',
      seat: event.seat,
      building: 'sawmill',
    })

    return [{ t: 'event', event }]
  },
}
