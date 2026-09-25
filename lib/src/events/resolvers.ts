import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import type { GameState } from '#state/types.js'
import { battleResolver } from '#events/battle.js'
import { chooseKeepResolver } from '#events/chooseKeep.js'
import { chooseLeaderResolver } from '#events/chooseLeader.js'
import { fieldHospitalResolver } from '#events/fieldHospital.js'
import { outrageResolver } from '#events/outrage.js'
import { placeStartingBuildingResolver } from '#events/placeStartingBuilding.js'
import type { Event } from '#events/types.js'
import {
  isBattleEvent,
  isChooseKeepEvent,
  isChooseLeaderEvent,
  isFieldHospitalEvent,
  isOutrageEvent,
  isPlaceStartingBuildingEvent,
} from '#typeGuards.js'

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
  chooseKeep: {
    legalActions(state, event, ctx) {
      if (!isChooseKeepEvent(event)) return []
      return chooseKeepResolver.legalActions(state, event, ctx)
    },
    apply(state, apply, ctx) {
      if (!isChooseKeepEvent(apply.event)) return []
      return chooseKeepResolver.apply(
        state,
        { event: apply.event, action: apply.action, actor: apply.actor },
        ctx,
      )
    },
    matchesAction(state, event, action, ctx) {
      if (!isChooseKeepEvent(event)) return false
      return chooseKeepResolver.matchesAction(state, event, action, ctx)
    },
  },
  placeStartingBuilding: {
    legalActions(state, event, ctx) {
      if (!isPlaceStartingBuildingEvent(event)) return []
      return placeStartingBuildingResolver.legalActions(state, event, ctx)
    },
    apply(state, apply, ctx) {
      if (!isPlaceStartingBuildingEvent(apply.event)) return []
      return placeStartingBuildingResolver.apply(
        state,
        { event: apply.event, action: apply.action, actor: apply.actor },
        ctx,
      )
    },
    matchesAction(state, event, action, ctx) {
      if (!isPlaceStartingBuildingEvent(event)) return false
      return placeStartingBuildingResolver.matchesAction(state, event, action, ctx)
    },
  },
  chooseLeader: {
    legalActions(state, event, ctx) {
      if (!isChooseLeaderEvent(event)) return []
      return chooseLeaderResolver.legalActions(state, event, ctx)
    },
    apply(state, apply, ctx) {
      if (!isChooseLeaderEvent(apply.event)) return []
      return chooseLeaderResolver.apply(
        state,
        { event: apply.event, action: apply.action, actor: apply.actor },
        ctx,
      )
    },
    matchesAction(state, event, action, ctx) {
      if (!isChooseLeaderEvent(event)) return false
      return chooseLeaderResolver.matchesAction(state, event, action, ctx)
    },
  },
  outrage: {
    legalActions(state, event, ctx) {
      if (!isOutrageEvent(event)) return []
      return outrageResolver.legalActions(state, event, ctx)
    },
    apply(state, apply, ctx) {
      if (!isOutrageEvent(apply.event)) return []
      return outrageResolver.apply(
        state,
        { event: apply.event, action: apply.action, actor: apply.actor },
        ctx,
      )
    },
    matchesAction(state, event, action, ctx) {
      if (!isOutrageEvent(event)) return false
      return outrageResolver.matchesAction(state, event, action, ctx)
    },
  },
  vagabondDamage: {
    legalActions: () => [],
    apply: () => [],
    matchesAction: () => false,
  },
}
