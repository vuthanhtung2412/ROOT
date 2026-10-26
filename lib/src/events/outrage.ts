import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import { Deck } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { matchesSuit } from '#cards/suit.js'
import {
  addSupporter,
  allianceSeat,
  boardOf,
} from '#factions/alliance/rules.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { Seat } from '#pieces/types.js'
import { factionOf, playerOf } from '#queries/seat.js'
import { applyAutomatedOutrage } from '#factions/bots/automatedAlliance/outrage.js'
import { isBotSeat } from '#factions/bots/botFactions.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { OutrageEvent } from '#events/types.js'

export type OutrageApply = {
  event: OutrageEvent
  action: ResolveEventAction
  actor: Seat
}

export type OutrageResolver = {
  legalActions(state: GameState, event: OutrageEvent, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: OutrageApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: OutrageEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

export const outrageResolver: OutrageResolver = {
  matchesAction(state, event, action, ctx) {
    if (action.type !== 'resolveEvent') return false
    return this.legalActions(state, event, ctx).some((spec) => {
      if (spec.type !== 'resolveEvent' || spec.actor !== event.offender) {
        return false
      }
      if (action.decline === true && spec.params?.decline?.includes(true)) {
        return true
      }
      if (
        action.cardId !== undefined &&
        spec.params?.cardIds?.includes(action.cardId)
      ) {
        return true
      }
      return false
    })
  },

  legalActions(state, event, _ctx) {
    const suit = FALL.clearings[event.clearing]!.suit
    const matching = playerOf(state, event.offender).hand.filter((card) =>
      matchesSuit(card, suit),
    )
    if (matching.length === 0) {
      // Rule: Outrage 2 — no matching card → reveal hand → Alliance draws.
      return [
        {
          type: 'resolveEvent',
          actor: event.offender,
          params: { decline: [true] },
        },
      ]
    }
    return matching.map((card) => ({
      type: 'resolveEvent' as const,
      actor: event.offender,
      params: { cardIds: [card.id] },
    }))
  },

  apply(state, { event, action, actor }, ctx) {
    if (actor !== event.offender) {
      throw new RuleError('WRONG_ACTOR', { actor })
    }
    const alliance = allianceSeat(state)
    if (alliance === null) {
      throw new RuleError('NO_ALLIANCE')
    }

    const pendingIndex = state.pending.findIndex((pending) => pending === event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    if (factionOf(state, alliance) === 'automatedAlliance') {
      return applyAutomatedOutrage(state, { event, action, alliance }, ctx)
    }
    const board = boardOf(state, alliance)

    if (action.decline === true) {
      const drawn = Deck.draw(state.deck, 1, {
        shuffle: (cards: Card[]): Card[] => cards,
        onDominance: (card: Card): void => {
          state.dominanceAvailable.push(card)
        },
      })
      for (const card of drawn) {
        const overflow = addSupporter(board, card)
        for (const discarded of overflow) {
          Deck.discard(state.deck, discarded, {
            onDominance: (dominanceCard) =>
              state.dominanceAvailable.push(dominanceCard),
          })
        }
      }
      ctx.emit({ s: 'draw', actor: alliance, count: drawn.length })
      return [{ t: 'event', event }]
    }

    if (action.cardId === undefined) {
      throw new RuleError('MISSING_OUTRAGE_CARD')
    }
    const offender = playerOf(state, event.offender)
    const cardIndex = offender.hand.findIndex((card) => card.id === action.cardId)
    if (cardIndex < 0) {
      throw new RuleError('CARD_NOT_IN_HAND', { cardId: action.cardId })
    }
    const card = offender.hand.splice(cardIndex, 1)[0]!
    const suit = FALL.clearings[event.clearing]!.suit
    if (!matchesSuit(card, suit)) {
      throw new RuleError('OUTRAGE_SUIT_MISMATCH', { cardId: action.cardId })
    }
    const overflow = addSupporter(board, card)
    for (const discarded of overflow) {
      Deck.discard(state.deck, discarded, {
        onDominance: (dominanceCard) =>
          state.dominanceAvailable.push(dominanceCard),
      })
    }
    return [{ t: 'event', event }]
  },
}

export function enqueueOutrage(
  state: GameState,
  offender: Seat,
  clearing: number,
): void {
  const alliance = allianceSeat(state)
  if (alliance === null) return
  if (offender === alliance) return
  // Rule: Rootbotics 6.2.3 — Automated Outrage is triggered by humans only.
  if (factionOf(state, alliance) === 'automatedAlliance' && isBotSeat(state, offender)) {
    return
  }
  state.pending.push({
    type: 'outrage',
    offender,
    clearing,
  })
}
