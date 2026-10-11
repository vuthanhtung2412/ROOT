import { describe, expect, it } from 'vitest'
import type { Card } from '#cards/types.js'
import {
  markHiddenInformation,
  revealedHiddenInformation,
  type HiddenInformationMark,
} from '#game/hiddenInformation.js'
import type { Seat } from '#pieces/types.js'
import type { Rng } from '#rules/Rng.js'
import type { GameState } from '#state/types.js'
import { card, createTestRng, minimalState, player } from '#test/fixtures.js'

const TURN_SEAT: Seat = 0
const OTHER_SEAT: Seat = 1
const TURN_PLAYER_CARD: Card = card('ROOT-209')
const OTHER_PLAYER_CARD: Card = card('ROOT-211')
const DECK_CARD: Card = card('ROOT-212')

/** Turn of seat 0; each player holds one card, one card in the deck. */
function stateWithHands(): GameState {
  return minimalState({
    currentSeat: TURN_SEAT,
    players: [
      player(TURN_SEAT, 'marquise', { hand: [TURN_PLAYER_CARD] }),
      player(OTHER_SEAT, 'eyrie', { hand: [OTHER_PLAYER_CARD] }),
    ],
    deck: { draw: [DECK_CARD], discard: [] },
  })
}

function withHands(
  state: GameState,
  turnPlayerHand: Card[],
  otherPlayerHand: Card[],
): GameState {
  return {
    ...state,
    players: [
      { ...state.players[TURN_SEAT]!, hand: turnPlayerHand },
      { ...state.players[OTHER_SEAT]!, hand: otherPlayerHand },
    ],
  }
}

describe('hidden information revealed by an action', () => {
  it('nothing is revealed when nothing hidden moved', () => {
    const state: GameState = stateWithHands()
    const rng: Rng = createTestRng()
    const before: HiddenInformationMark = markHiddenInformation(state, rng)

    expect(revealedHiddenInformation(before, state, rng)).toBe(false)
  })

  it('a rolled die reveals', () => {
    const state: GameState = stateWithHands()
    const rng: Rng = createTestRng([2])
    const before: HiddenInformationMark = markHiddenInformation(state, rng)

    rng.roll()

    expect(revealedHiddenInformation(before, state, rng)).toBe(true)
  })

  it('a draw from the deck reveals', () => {
    const state: GameState = stateWithHands()
    const rng: Rng = createTestRng()
    const before: HiddenInformationMark = markHiddenInformation(state, rng)

    const after: GameState = { ...state, deck: { draw: [], discard: [] } }

    expect(revealedHiddenInformation(before, after, rng)).toBe(true)
  })

  it('a quest drawn from the quest deck reveals', () => {
    const state: GameState = {
      ...stateWithHands(),
      questDeck: [{ id: 'quest-1', defId: 'errand-fox' }],
    }
    const rng: Rng = createTestRng()
    const before: HiddenInformationMark = markHiddenInformation(state, rng)

    const after: GameState = { ...state, questDeck: [] }

    expect(revealedHiddenInformation(before, after, rng)).toBe(true)
  })

  it('a card leaving the hand of another player reveals', () => {
    const state: GameState = stateWithHands()
    const rng: Rng = createTestRng()
    const before: HiddenInformationMark = markHiddenInformation(state, rng)

    const after: GameState = withHands(state, [TURN_PLAYER_CARD], [])

    expect(revealedHiddenInformation(before, after, rng)).toBe(true)
  })

  it('a card entering the hand of another player reveals', () => {
    const state: GameState = stateWithHands()
    const rng: Rng = createTestRng()
    const before: HiddenInformationMark = markHiddenInformation(state, rng)

    const after: GameState = withHands(
      state,
      [],
      [OTHER_PLAYER_CARD, TURN_PLAYER_CARD],
    )

    expect(revealedHiddenInformation(before, after, rng)).toBe(true)
  })

  it('the turn player spending a card reveals nothing', () => {
    const state: GameState = stateWithHands()
    const rng: Rng = createTestRng()
    const before: HiddenInformationMark = markHiddenInformation(state, rng)

    const after: GameState = withHands(state, [], [OTHER_PLAYER_CARD])

    expect(revealedHiddenInformation(before, after, rng)).toBe(false)
  })
})
