import type { Action, ActionSpec, ResolveEventAction } from '../actions/types.js'
import { Deck } from '../cards/Deck.js'
import { matchesSuit } from '../cards/suit.js'
import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import { FALL } from '../map/fall.js'
import type { Seat } from '../pieces/types.js'
import { keepClearingFor } from '../queries/place.js'
import { playerOf } from '../queries/seat.js'
import { placeReturning } from '../rules/place.js'
import { returnWarriorsToSupply } from '../rules/remove.js'
import { RuleError } from '../rules/RuleError.js'
import type { GameState } from '../state/types.js'
import type { FieldHospitalEvent } from './types.js'

export type FieldHospitalApply = {
  event: FieldHospitalEvent
  action: ResolveEventAction
  actor: Seat
}

export type FieldHospitalResolver = {
  legalActions(state: GameState, event: FieldHospitalEvent, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: FieldHospitalApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: FieldHospitalEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

export const fieldHospitalResolver: FieldHospitalResolver = {
  matchesAction(state, event, action, ctx) {
    if (action.type !== 'resolveEvent') return false
    return this.legalActions(state, event, ctx).some((spec) => {
      if (spec.type !== 'resolveEvent' || spec.actor !== event.victim) return false
      if (action.decline && spec.params?.decline?.includes(true)) return true
      if (action.cardId && spec.params?.cardIds?.includes(action.cardId)) return true
      return false
    })
  },

  legalActions(state, event, _ctx) {
    const suit = FALL.clearings[event.clearing]!.suit
    const specs: ActionSpec[] = [
      { type: 'resolveEvent', actor: event.victim, params: { decline: [true] } },
    ]
    for (const card of playerOf(state, event.victim).hand) {
      if (matchesSuit(card, suit)) {
        specs.push({
          type: 'resolveEvent',
          actor: event.victim,
          params: { cardIds: [card.id] },
        })
      }
    }
    return specs
  },

  apply(state, { event, action, actor }, ctx) {
    if (actor !== event.victim) throw new RuleError('WRONG_ACTOR', { actor })

    const pendingIndex = state.pending.findIndex((pending) => pending === event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    if (action.decline) {
      returnWarriorsToSupply(state, event.victim, event.count)
      ctx.emit({
        s: 'warriors.removed',
        victim: event.victim,
        faction: playerOf(state, event.victim).faction,
        clearing: event.clearing,
        count: event.count,
        toSupply: true,
      })
      return [{ t: 'event', event }]
    }

    if (!action.cardId) throw new RuleError('MISSING_FIELD_HOSPITAL_CARD')
    const player = playerOf(state, event.victim)
    const cardIndex = player.hand.findIndex((card) => card.id === action.cardId)
    if (cardIndex < 0) throw new RuleError('CARD_NOT_IN_HAND', { cardId: action.cardId })
    const card = player.hand.splice(cardIndex, 1)[0]!
    if (!matchesSuit(card, FALL.clearings[event.clearing]!.suit)) {
      throw new RuleError('FIELD_HOSPITAL_SUIT_MISMATCH', { cardId: action.cardId })
    }
    Deck.discard(state.deck, card, {
      onDominance: (dominanceCard) => state.dominanceAvailable.push(dominanceCard),
    })

    const keep = keepClearingFor(state, event.victim)
    if (keep === null) {
      returnWarriorsToSupply(state, event.victim, event.count)
      ctx.emit({
        s: 'warriors.removed',
        victim: event.victim,
        faction: player.faction,
        clearing: event.clearing,
        count: event.count,
        toSupply: true,
      })
    } else {
      // Rule: Marquise > Field Hospitals — warriors already off map; do not pull supply.
      const placed = placeReturning(state, {
        seat: event.victim,
        clearing: keep,
        spec: { kind: 'warrior' },
        count: event.count,
      })
      if (placed < event.count) {
        const leftover = event.count - placed
        returnWarriorsToSupply(state, event.victim, leftover)
        ctx.emit({
          s: 'warriors.removed',
          victim: event.victim,
          faction: player.faction,
          clearing: event.clearing,
          count: leftover,
          toSupply: true,
        })
      }
    }

    return [{ t: 'event', event }]
  },
}
