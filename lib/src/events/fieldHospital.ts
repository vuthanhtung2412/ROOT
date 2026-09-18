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

export type FieldHospitalResolver = {
  legalActions(state: GameState, ev: FieldHospitalEvent, ctx: Ctx): ActionSpec[]
  apply(
    state: GameState,
    ev: FieldHospitalEvent,
    action: ResolveEventAction,
    actor: Seat,
    ctx: Ctx,
  ): LogEntry[]
  matchesAction(state: GameState, ev: FieldHospitalEvent, action: Action, ctx: Ctx): boolean
}

export const fieldHospitalResolver: FieldHospitalResolver = {
  matchesAction(state, ev, action, ctx) {
    if (action.type !== 'resolveEvent') return false
    return this.legalActions(state, ev, ctx).some((spec) => {
      if (spec.type !== 'resolveEvent' || spec.actor !== ev.victim) return false
      if (action.decline && spec.params?.decline?.includes(true)) return true
      if (action.cardId && spec.params?.cardIds?.includes(action.cardId)) return true
      return false
    })
  },

  legalActions(state, ev, _ctx) {
    const suit = FALL.clearings[ev.clearing]!.suit
    const specs: ActionSpec[] = [
      { type: 'resolveEvent', actor: ev.victim, params: { decline: [true] } },
    ]
    for (const c of playerOf(state, ev.victim).hand) {
      if (matchesSuit(c, suit)) {
        specs.push({
          type: 'resolveEvent',
          actor: ev.victim,
          params: { cardIds: [c.id] },
        })
      }
    }
    return specs
  },

  apply(state, ev, action, actor, ctx) {
    if (actor !== ev.victim) throw new RuleError('WRONG_ACTOR', { actor })

    const idx = state.pending.indexOf(ev)
    if (idx >= 0) state.pending.splice(idx, 1)

    if (action.decline) {
      returnWarriorsToSupply(state, ev.victim, ev.count)
      return [{ t: 'event', event: ev }]
    }

    if (!action.cardId) throw new RuleError('MISSING_FIELD_HOSPITAL_CARD')
    const player = playerOf(state, ev.victim)
    const cardIdx = player.hand.findIndex((c) => c.id === action.cardId)
    if (cardIdx < 0) throw new RuleError('CARD_NOT_IN_HAND', { cardId: action.cardId })
    const card = player.hand.splice(cardIdx, 1)[0]!
    if (!matchesSuit(card, FALL.clearings[ev.clearing]!.suit)) {
      throw new RuleError('FIELD_HOSPITAL_SUIT_MISMATCH', { cardId: action.cardId })
    }
    Deck.discard(state.deck, card, {
      onDominance: (c) => state.dominanceAvailable.push(c),
    })

    const keep = keepClearingFor(state, ev.victim)
    if (keep === null) {
      returnWarriorsToSupply(state, ev.victim, ev.count)
    } else {
      // Rule: Marquise > Field Hospitals — warriors already off map; do not pull supply.
      const placed = placeReturning(state, { seat: ev.victim, clearing: keep, spec: { kind: 'warrior' }, count: ev.count })
      if (placed < ev.count) {
        returnWarriorsToSupply(state, ev.victim, ev.count - placed)
      }
    }

    return [{ t: 'event', event: ev }]
  },
}
