import type { ResolveEventAction } from '#actions/types.js'
import { Deck } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { matchesSuit } from '#cards/suit.js'
import type { OutrageEvent } from '#events/types.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { addVictoryPoints } from '#rules/dominance.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 6.2.3 — no matching card: the Alliance scores one point. */
const AUTOMATED_OUTRAGE_VICTORY_POINTS = 1

export type AutomatedOutrage = {
  event: OutrageEvent
  action: ResolveEventAction
  alliance: Seat
}

/**
 * Rule: Rootbotics 6.2.3 Automated Outrage — the human discards a matching
 * card; if they cannot, the Alliance scores one point. The card is
 * discarded, not given (no Poor Manual Dexterity point).
 */
export function applyAutomatedOutrage(
  state: GameState,
  outrage: AutomatedOutrage,
  ctx: Ctx,
): LogEntry[] {
  const { event, action, alliance } = outrage
  if (action.decline === true) {
    const scored = addVictoryPoints(state, alliance, AUTOMATED_OUTRAGE_VICTORY_POINTS)
    const logs: LogEntry[] = [{ t: 'event', event }]
    if (scored === 0) return logs
    ctx.emit({ s: 'vp', actor: alliance, delta: scored })
    return [...logs, { t: 'vp', actor: alliance, delta: scored, reason: 'outrage' }]
  }
  if (action.cardId === undefined) {
    throw new RuleError('MISSING_OUTRAGE_CARD')
  }
  const offender = playerOf(state, event.offender)
  const card: Card | undefined = offender.hand.find(
    (entry: Card): boolean => entry.id === action.cardId,
  )
  if (card === undefined) {
    throw new RuleError('CARD_NOT_IN_HAND', { cardId: action.cardId })
  }
  if (!matchesSuit(card, FALL.clearings[event.clearing]!.suit)) {
    throw new RuleError('OUTRAGE_SUIT_MISMATCH', { cardId: action.cardId })
  }
  offender.hand = offender.hand.filter((entry: Card): boolean => entry !== card)
  Deck.discard(state.deck, card, {
    onDominance: (dominanceCard: Card): void => {
      state.dominanceAvailable.push(dominanceCard)
    },
  })
  return [{ t: 'event', event }]
}
