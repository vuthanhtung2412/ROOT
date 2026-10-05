import { Deck } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import type { Ctx } from '#game/ctx.js'
import type { Seat } from '#pieces/types.js'
import { ALLIANCE_STARTING_SUPPORTERS } from '#state/boards.js'
import type { GameState } from '#state/types.js'
import { boardOf } from '#factions/alliance/rules.js'

/** Rule: Alliance > Setup 4 — draw 3 → Supporters (after hands). */
export function drawStartingSupporters(
  state: GameState,
  seat: Seat,
  _ctx: Ctx,
): void {
  const board = boardOf(state, seat)
  const drawn = Deck.draw(state.deck, ALLIANCE_STARTING_SUPPORTERS, {
    shuffle: (cards: Card[]): Card[] => cards,
    onDominance: (card: Card): void => {
      state.dominanceAvailable.push(card)
    },
  })
  board.supporters.push(...drawn)
}

export function placeAllianceSetup(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): void {
  drawStartingSupporters(state, seat, ctx)
}
