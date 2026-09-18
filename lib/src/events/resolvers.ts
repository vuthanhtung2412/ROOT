import type { Action, ActionSpec, ResolveEventAction } from '../actions/types.js'
import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import type { Seat } from '../pieces/types.js'
import type { GameState } from '../state/types.js'
import { isBattleEvent, isFieldHospitalEvent } from '../typeGuards.js'
import { battleResolver } from './battle.js'
import { fieldHospitalResolver } from './fieldHospital.js'
import type { Event } from './types.js'

export type EventApply = {
  event: Event
  action: ResolveEventAction
  actor: Seat
}

export type AnyEventResolver = {
  legalActions(state: GameState, event: Event, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: EventApply, ctx: Ctx): LogEntry[]
  matchesAction(state: GameState, event: Event, action: Action, ctx: Ctx): boolean
}

export const RESOLVERS: Record<Event['type'], AnyEventResolver> = {
  battle: {
    legalActions(state, event, ctx) {
      if (!isBattleEvent(event)) return []
      return battleResolver.legalActions(state, event, ctx)
    },
    apply(state, apply, ctx) {
      if (!isBattleEvent(apply.event)) return []
      return battleResolver.apply(
        state,
        { event: apply.event, action: apply.action, actor: apply.actor },
        ctx,
      )
    },
    matchesAction(state, event, action, ctx) {
      if (!isBattleEvent(event)) return false
      return battleResolver.matchesAction(state, event, action, ctx)
    },
  },
  fieldHospital: {
    legalActions(state, event, ctx) {
      if (!isFieldHospitalEvent(event)) return []
      return fieldHospitalResolver.legalActions(state, event, ctx)
    },
    apply(state, apply, ctx) {
      if (!isFieldHospitalEvent(apply.event)) return []
      return fieldHospitalResolver.apply(
        state,
        { event: apply.event, action: apply.action, actor: apply.actor },
        ctx,
      )
    },
    matchesAction(state, event, action, ctx) {
      if (!isFieldHospitalEvent(event)) return false
      return fieldHospitalResolver.matchesAction(state, event, action, ctx)
    },
  },
  outrage: {
    legalActions: () => [],
    apply: () => [],
    matchesAction: () => false,
  },
  vagabondDamage: {
    legalActions: () => [],
    apply: () => [],
    matchesAction: () => false,
  },
}
