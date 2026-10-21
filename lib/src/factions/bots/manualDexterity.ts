import { Deck } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { isBotSeat } from '#factions/bots/botFactions.js'
import { drawCards } from '#factions/sharedTurn.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { addVictoryPoints } from '#rules/dominance.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 2.8.1 — a bot scores one point per card given to it. */
const VICTORY_POINTS_PER_GIVEN_CARD = 1
/** Rule: Rootbotics 2.8.1 — a human taking a card from a bot draws one instead. */
const CARDS_DRAWN_INSTEAD_OF_TAKEN = 1

export type CardGift = {
  card: Card
  receiver: Seat
}

/**
 * Hand a card to a player. Rule: Rootbotics 2.8.1 Poor Manual Dexterity —
 * a bot has no hand: the card is discarded and the bot scores one point.
 */
export function giveCard(
  state: GameState,
  gift: CardGift,
  ctx: Ctx,
): LogEntry[] {
  if (!isBotSeat(state, gift.receiver)) {
    playerOf(state, gift.receiver).hand.push(gift.card)
    return []
  }
  Deck.discard(state.deck, gift.card, {
    onDominance: (dominanceCard: Card): void => {
      state.dominanceAvailable.push(dominanceCard)
    },
  })
  const scored = addVictoryPoints(
    state,
    gift.receiver,
    VICTORY_POINTS_PER_GIVEN_CARD,
  )
  if (scored === 0) return []
  ctx.emit({ s: 'vp', actor: gift.receiver, delta: scored })
  return [
    { t: 'vp', actor: gift.receiver, delta: scored, reason: 'card given to bot' },
  ]
}

/** A card can be taken from this player: some card in hand, or a bot. */
export function hasCardToTake(state: GameState, seat: Seat): boolean {
  return isBotSeat(state, seat) || playerOf(state, seat).hand.length > 0
}

/** Rule: Rootbotics 2.8.1 — taking from a bot: the taker draws a card instead. */
export function drawInsteadOfTakingFromBot(
  state: GameState,
  taker: Seat,
  ctx: Ctx,
): void {
  drawCards(state, { seat: taker, count: CARDS_DRAWN_INSTEAD_OF_TAKEN }, ctx)
}
