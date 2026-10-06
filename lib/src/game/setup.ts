import { Deck, defOf } from '#cards/Deck.js'
import { EP_DECK } from '#cards/epDeck.js'
import type { Card } from '#cards/types.js'
import type { ClearingId } from '#map/types.js'
import { resetPlaceIds } from '#rules/place.js'
import { randomIndex, type Rng } from '#rules/Rng.js'
import {
  ITEM_SUPPLY,
  RUIN_ITEMS,
  STARTING_HAND,
} from '#state/constants.js'
import type { GameState } from '#state/types.js'
import { createTurnScratch } from '#state/turnScratch.js'

const CLEARING_COUNT = 12
const RUIN_CLEARINGS: ClearingId[] = [5, 9, 10, 11]

function shuffleWithRng<T>(items: T[], rng: Rng): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = randomIndex(rng, index + 1)
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ]
  }
  return shuffled
}

export type InitialStateOptions = {
  id: string
  seed: number
  factions: GameState['factions']
}

export function createInitialState(
  options: InitialStateOptions,
): GameState {
  return {
    id: options.id,
    seed: options.seed,
    map: 'fall',
    status: 'waiting',
    turn: 1,
    currentSeat: 0,
    phase: 'birdsong',
    step: 'wood',
    factions: options.factions,
    players: [],
    clearings: Array.from(
      { length: CLEARING_COUNT },
      (): GameState['clearings'][number] => ({ pieces: [] }),
    ),
    deck: { draw: [], discard: [] },
    dominanceAvailable: [],
    questDeck: [],
    questsAvailable: [],
    itemSupply: { ...ITEM_SUPPLY },
    pending: [],
    turnScratch: createTurnScratch(),
  }
}

export function runSharedSetup(state: GameState, rng: Rng): void {
  resetPlaceIds()

  for (const player of state.players) {
    player.vp = 0
    player.scoresVictoryPoints = true
    player.hand = []
    player.playArea = []
    player.activatedDominance = null
    player.coalitionWith = null
    player.craftedItems = []
  }

  let deckCards: Card[] = [...EP_DECK]
  if (state.players.length === 2) {
    // Rule: Setup 3 — 2p removes all dominance before shuffle.
    deckCards = deckCards.filter(
      (card: Card): boolean => defOf(card).type !== 'dominance',
    )
  }

  state.deck = {
    draw: shuffleWithRng(deckCards, rng),
    discard: [],
  }
  // Rule: 10.2.6 — the Lost Souls pile exists only with the Lizard Cult.
  if (state.players.some((player): boolean => player.faction === 'lizard')) {
    state.deck.lostSouls = []
  }
  state.dominanceAvailable = []

  for (const player of state.players) {
    player.hand = Deck.draw(state.deck, STARTING_HAND, {
      shuffle: (cards: Card[]): Card[] => shuffleWithRng(cards, rng),
      onDominance: (card: Card): void => {
        state.dominanceAvailable.push(card)
      },
    })
  }

  state.itemSupply = { ...ITEM_SUPPLY }

  const ruinItems = shuffleWithRng([...RUIN_ITEMS], rng)
  for (let index = 0; index < RUIN_CLEARINGS.length; index++) {
    const clearing = RUIN_CLEARINGS[index]!
    state.clearings[clearing] = {
      pieces: [],
      ruin: { items: [ruinItems[index]!] },
    }
  }
}
