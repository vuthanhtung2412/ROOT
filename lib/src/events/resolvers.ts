import type { Action, ActionSpec, ResolveEventAction } from '../actions/types.js'
import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import type { Seat } from '../pieces/types.js'
import type { GameState } from '../state/types.js'
import { battleResolver } from './battle.js'
import { fieldHospitalResolver } from './fieldHospital.js'
import type { Event } from './types.js'

export type AnyEventResolver = {
  legalActions(state: GameState, ev: Event, ctx: Ctx): ActionSpec[]
  apply(state: GameState, ev: Event, action: ResolveEventAction, actor: Seat, ctx: Ctx): LogEntry[]
  matchesAction(state: GameState, ev: Event, action: Action, ctx: Ctx): boolean
}

export const RESOLVERS: Record<Event['type'], AnyEventResolver> = {
  battle: battleResolver as AnyEventResolver,
  fieldHospital: fieldHospitalResolver as AnyEventResolver,
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
