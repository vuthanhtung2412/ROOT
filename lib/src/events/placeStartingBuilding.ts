import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import { setUpFactionsAfterMarquise } from '#game/factionSetup.js'
import {
  fillMarquiseSetupTracks,
  legalStartingBuildingClearings,
  placeMarquiseStartingBuilding,
} from '#factions/Marquise.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { isClearingId } from '#typeGuards.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { PlaceStartingBuildingEvent } from '#events/types.js'

export type PlaceStartingBuildingApply = {
  event: PlaceStartingBuildingEvent
  action: ResolveEventAction
  actor: Seat
}

export type PlaceStartingBuildingResolver = {
  legalActions(
    state: GameState,
    event: PlaceStartingBuildingEvent,
    ctx: Ctx,
  ): ActionSpec[]
  apply(
    state: GameState,
    apply: PlaceStartingBuildingApply,
    ctx: Ctx,
  ): LogEntry[]
  matchesAction(
    state: GameState,
    event: PlaceStartingBuildingEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

const STARTING_BUILDING_ORDER = ['sawmill', 'workshop', 'recruiter'] as const

function nextStartingBuilding(
  current: PlaceStartingBuildingEvent['building'],
): PlaceStartingBuildingEvent['building'] | null {
  const index = STARTING_BUILDING_ORDER.indexOf(current)
  if (index < 0 || index >= STARTING_BUILDING_ORDER.length - 1) {
    return null
  }
  return STARTING_BUILDING_ORDER[index + 1]!
}

function finishMarquiseSetupAfterBuildings(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): void {
  fillMarquiseSetupTracks(state, seat)
  setUpFactionsAfterMarquise(state, ctx)
}

export const placeStartingBuildingResolver: PlaceStartingBuildingResolver = {
  matchesAction(state, event, action, ctx) {
    if (action.type !== 'resolveEvent') return false
    if (action.clearing === undefined || !isClearingId(action.clearing)) return false
    return this.legalActions(state, event, ctx).some((spec) => {
      if (spec.type !== 'resolveEvent' || spec.actor !== event.seat) return false
      return spec.params?.clearing?.includes(action.clearing!) === true
    })
  },

  legalActions(state, event, _ctx) {
    const clearings = legalStartingBuildingClearings(state, event.seat)
    if (clearings.length === 0) return []
    return [
      {
        type: 'resolveEvent',
        actor: event.seat,
        params: {
          clearing: clearings,
          building: [event.building],
        },
      },
    ]
  },

  apply(state, { event, action, actor }, ctx) {
    if (actor !== event.seat) throw new RuleError('WRONG_ACTOR', { actor })
    if (action.clearing === undefined || !isClearingId(action.clearing)) {
      throw new RuleError('MISSING_BUILDING_CLEARING')
    }

    const pendingIndex = state.pending.indexOf(event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    placeMarquiseStartingBuilding(state, {
      seat: event.seat,
      clearing: action.clearing,
      building: event.building,
    })

    const next = nextStartingBuilding(event.building)
    if (next !== null) {
      state.pending.push({
        type: 'placeStartingBuilding',
        seat: event.seat,
        building: next,
      })
    } else {
      finishMarquiseSetupAfterBuildings(state, event.seat, ctx)
    }

    return [{ t: 'event', event }]
  },
}
