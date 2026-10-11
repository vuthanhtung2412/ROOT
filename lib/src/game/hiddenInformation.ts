import type { Card } from '#cards/types.js'
import type { Seat } from '#pieces/types.js'
import type { Rng } from '#rules/Rng.js'
import type { GameState, PlayerState } from '#state/types.js'

/** Where the hidden information of a game stood before an action. */
export type HiddenInformationMark = {
  /** Dice rolled so far (battle rolls, random takes, shuffles). */
  diceRolled: number
  drawPileSize: number
  questDeckSize: number
  /** Card ids in each hand, by seat. */
  handCardIdsBySeat: ReadonlyMap<Seat, readonly string[]>
}

export function markHiddenInformation(
  state: GameState,
  rng: Rng,
): HiddenInformationMark {
  const handCardIdsBySeat: Map<Seat, readonly string[]> = new Map<
    Seat,
    readonly string[]
  >()
  for (const player of state.players) {
    handCardIdsBySeat.set(
      player.seat,
      player.hand.map((handCard: Card): string => handCard.id),
    )
  }
  return {
    diceRolled: rng.toJSON().cursor,
    drawPileSize: state.deck.draw.length,
    questDeckSize: state.questDeck.length,
    handCardIdsBySeat,
  }
}

/** A player other than the one whose turn it is no longer holds a card. */
function anotherPlayerLostCard(
  before: HiddenInformationMark,
  state: GameState,
): boolean {
  return state.players.some((player: PlayerState): boolean => {
    if (player.seat === state.currentSeat) return false
    const heldNow: ReadonlySet<string> = new Set<string>(
      player.hand.map((handCard: Card): string => handCard.id),
    )
    const heldBefore: readonly string[] =
      before.handCardIdsBySeat.get(player.seat) ?? []
    return heldBefore.some((cardId: string): boolean => !heldNow.has(cardId))
  })
}

/**
 * An action whose outcome the player could not know cannot be taken back:
 * it rolled dice, drew from the deck or the quest deck, or took a card out
 * of another player's hand.
 */
export function revealedHiddenInformation(
  before: HiddenInformationMark,
  state: GameState,
  rng: Rng,
): boolean {
  return (
    rng.toJSON().cursor !== before.diceRolled ||
    state.deck.draw.length !== before.drawPileSize ||
    state.questDeck.length !== before.questDeckSize ||
    anotherPlayerLostCard(before, state)
  )
}
