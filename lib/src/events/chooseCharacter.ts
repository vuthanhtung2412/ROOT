import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import { assignVagabondCharacter } from '#factions/Vagabond.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { RuleError } from '#rules/RuleError.js'
import { VAGABOND_CHARACTERS } from '#state/boards.js'
import type { GameState } from '#state/types.js'
import { isVagabondCharacter } from '#typeGuards.js'
import type { ChooseCharacterEvent } from '#events/types.js'

export type ChooseCharacterApply = {
  event: ChooseCharacterEvent
  action: ResolveEventAction
  actor: Seat
}

export type ChooseCharacterResolver = {
  legalActions(
    state: GameState,
    event: ChooseCharacterEvent,
    ctx: Ctx,
  ): ActionSpec[]
  apply(state: GameState, apply: ChooseCharacterApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: ChooseCharacterEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

export const chooseCharacterResolver: ChooseCharacterResolver = {
  matchesAction(state, event, action, ctx) {
    if (action.type !== 'resolveEvent') return false
    if (
      action.character === undefined ||
      !isVagabondCharacter(action.character)
    ) {
      return false
    }
    return this.legalActions(state, event, ctx).some((spec) => {
      if (spec.type !== 'resolveEvent' || spec.actor !== event.seat) return false
      return spec.params?.characters?.includes(action.character!) === true
    })
  },

  legalActions(_state, event, _ctx) {
    return [
      {
        type: 'resolveEvent',
        actor: event.seat,
        params: { characters: [...VAGABOND_CHARACTERS] },
      },
    ]
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.seat) throw new RuleError('WRONG_ACTOR', { actor })
    if (
      action.character === undefined ||
      !isVagabondCharacter(action.character)
    ) {
      throw new RuleError('MISSING_CHARACTER')
    }

    const pendingIndex = state.pending.indexOf(event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    // Rule: Vagabond > Setup 1, 5 — character, then its starting items.
    assignVagabondCharacter(state, event.seat, action.character)

    return [{ t: 'event', event }]
  },
}
