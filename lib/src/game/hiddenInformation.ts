import type { Card } from '#cards/types.js'
import type { Seat } from '#pieces/types.js'
import type { Rng } from '#rules/Rng.js'
import type { GameState, PlayerState } from '#state/types.js'

/** Where the hidden information of a game stood before an action. */
export type HiddenInformationMark = {
  /** Dice rolled so far (battle rolls, random takes, shuffles). */
  diceRolled: number
  drawPileSize: number
  /** Hand that held each card, by card id. */
  handSeatByCardId: ReadonlyMap<string, Seat>
}

export function markHiddenInformation(
  state: GameState,
  rng: Rng,
): HiddenInformationMark {
  const handSeatByCardId: Map<string, Seat> = new Map<string, Seat>()
  for (const player of state.players) {
    for (const handCard of player.hand) {
      handSeatByCardId.set(handCard.id, player.seat)
    }
  }
  return {
    diceRolled: rng.toJSON().cursor,
    drawPileSize: state.deck.draw.length,
    handSeatByCardId,
  }
}

/** The player whose turn it is now holds a card another player held. */
function tookCardOfAnotherPlayer(
  before: HiddenInformationMark,
  state: GameState,
): boolean {
  const turnPlayer: PlayerState | undefined = state.players.find(
    (player: PlayerState): boolean => player.seat === state.currentSeat,
  )
  if (turnPlayer === undefined) return false
  return turnPlayer.hand.some((handCard: Card): boolean => {
    const seatBefore: Seat | undefined = before.handSeatByCardId.get(handCard.id)
    return seatBefore !== undefined && seatBefore !== turnPlayer.seat
  })
}

/**
 * An action whose outcome the player could not know cannot be taken back:
 * it rolled dice, drew from the deck, or took a card of another player.
 */
export function revealedHiddenInformation(
  before: HiddenInformationMark,
  state: GameState,
  rng: Rng,
): boolean {
  return (
    rng.toJSON().cursor !== before.diceRolled ||
    state.deck.draw.length !== before.drawPileSize ||
    tookCardOfAnotherPlayer(before, state)
  )
}
