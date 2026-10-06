import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import { chooseStartingOutcast } from '#factions/lizard/setup.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { isSuit } from '#typeGuards.js'
import { RuleError } from '#rules/RuleError.js'
import { LIZARD_SUITS } from '#state/lizardBoard.js'
import type { GameState } from '#state/types.js'
import type { ChooseOutcastEvent } from '#events/types.js'

export type ChooseOutcastApply = {
  event: ChooseOutcastEvent
  action: ResolveEventAction
  actor: Seat
}

export type ChooseOutcastResolver = {
  legalActions(state: GameState, event: ChooseOutcastEvent, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: ChooseOutcastApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: ChooseOutcastEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

export const chooseOutcastResolver: ChooseOutcastResolver = {
  matchesAction(_state, _event, action, _ctx) {
    if (action.type !== 'resolveEvent') return false
    return action.suit !== undefined && isSuit(action.suit)
  },

  legalActions(_state, event, _ctx) {
    return [
      {
        type: 'resolveEvent',
        actor: event.seat,
        params: { suits: [...LIZARD_SUITS] },
      },
    ]
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.seat) throw new RuleError('WRONG_ACTOR', { actor })
    if (action.suit === undefined || !isSuit(action.suit)) {
      throw new RuleError('MISSING_OUTCAST_SUIT')
    }

    const pendingIndex = state.pending.indexOf(event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    // Rule: 10.3.3 — the suit of the chosen space is the Outcast.
    chooseStartingOutcast(state, event.seat, action.suit)

    return [{ t: 'event', event }]
  },
}
