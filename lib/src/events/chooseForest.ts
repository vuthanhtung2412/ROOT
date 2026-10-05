import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import { placeVagabondForest } from '#factions/Vagabond.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { Seat } from '#pieces/types.js'
import { isForestIndex } from '#typeGuards.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { ChooseForestEvent } from '#events/types.js'

export type ChooseForestApply = {
  event: ChooseForestEvent
  action: ResolveEventAction
  actor: Seat
}

export type ChooseForestResolver = {
  legalActions(state: GameState, event: ChooseForestEvent, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: ChooseForestApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: ChooseForestEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

function allForestIndexes(): number[] {
  return FALL.forests.map((_, forestIndex) => forestIndex)
}

export const chooseForestResolver: ChooseForestResolver = {
  matchesAction(state, event, action, ctx) {
    if (action.type !== 'resolveEvent') return false
    if (action.forest === undefined || !isForestIndex(action.forest)) return false
    return this.legalActions(state, event, ctx).some((spec) => {
      if (spec.type !== 'resolveEvent' || spec.actor !== event.seat) return false
      return spec.params?.forests?.includes(action.forest!) === true
    })
  },

  legalActions(_state, event, _ctx) {
    return [
      {
        type: 'resolveEvent',
        actor: event.seat,
        params: { forests: allForestIndexes() },
      },
    ]
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.seat) throw new RuleError('WRONG_ACTOR', { actor })
    if (action.forest === undefined || !isForestIndex(action.forest)) {
      throw new RuleError('MISSING_FOREST')
    }

    const pendingIndex = state.pending.indexOf(event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    // Rule: Vagabond > Setup 2 — Place your Vagabond pawn in any forest.
    placeVagabondForest(state, event.seat, action.forest)

    return [{ t: 'event', event }]
  },
}
