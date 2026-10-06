import { actionMatchesOption } from '#actions/options.js'
import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import {
  buyService,
  purchasableServices,
  servicesPerTurn,
} from '#factions/riverfolk/services.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { BuyServicesEvent } from '#events/types.js'

export type BuyServicesApply = {
  event: BuyServicesEvent
  action: ResolveEventAction
  actor: Seat
}

export type BuyServicesResolver = {
  legalActions(state: GameState, event: BuyServicesEvent, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: BuyServicesApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: BuyServicesEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

function closeEvent(state: GameState, event: BuyServicesEvent): void {
  const pendingIndex = state.pending.indexOf(event)
  if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)
}

/**
 * Rule: 11.2.6 Buying Services — queue the offer when the player whose turn
 * starts can afford at least one service.
 */
export function offerRiverfolkServices(state: GameState): void {
  const buyer = state.currentSeat
  if (purchasableServices(state, buyer).length === 0) return
  state.pending.push({ type: 'buyServices', buyer, bought: 0 })
}

export const buyServicesResolver: BuyServicesResolver = {
  matchesAction(state, event, action, _ctx) {
    if (action.type !== 'resolveEvent') return false
    if (action.decline === true) return true
    if (action.service === undefined) return false
    return actionMatchesOption(action, purchasableServices(state, event.buyer))
  },

  legalActions(state, event, _ctx) {
    const options = purchasableServices(state, event.buyer)
    const specs: ActionSpec[] = []
    if (options.length > 0) {
      specs.push({
        type: 'resolveEvent',
        actor: event.buyer,
        params: { options },
      })
    }
    specs.push({
      type: 'resolveEvent',
      actor: event.buyer,
      params: { decline: [true] },
    })
    return specs
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.buyer) throw new RuleError('WRONG_ACTOR', { actor })
    if (action.decline === true) {
      closeEvent(state, event)
      return [{ t: 'event', event }]
    }
    if (action.service === undefined) {
      throw new RuleError('MISSING_SERVICE')
    }

    buyService(
      state,
      event.buyer,
      action.cardId === undefined
        ? { service: action.service }
        : { service: action.service, cardId: action.cardId },
    )
    event.bought += 1

    // Rule: 11.2.6.II — stop once the turn's services are bought or unaffordable.
    if (
      event.bought >= servicesPerTurn(state, event.buyer) ||
      purchasableServices(state, event.buyer).length === 0
    ) {
      closeEvent(state, event)
    }
    return [{ t: 'event', event: { ...event } }]
  },
}
