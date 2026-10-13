import { describe, expect, it } from 'vitest'
import type { Game } from '@root/lib'
import {
  lookUpCardDetails,
  missingCraftCost,
} from '#aiPlayer/aiPlayerCardDetail.js'
import {
  createStartedTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
  SECOND_TEST_PLAYER_ID,
} from '#test/gameStateFixtures.js'

const SWORD_CARD = { id: 'ROOT-224#1', defId: 'ROOT-224' }
const AMBUSH_CARD = { id: 'ROOT-200#1', defId: 'ROOT-200' }
const FOX_CLEARING = 0

/** Marquise (seat 0) holding a Sword and an Ambush, Eyrie holding a Sword copy. */
function createGameWithHands(): Game {
  const game = createStartedTwoPlayerGame()
  const [marquise, eyrie] = game.state.players
  if (marquise === undefined || eyrie === undefined) {
    throw new Error('fixture: two players expected')
  }
  marquise.hand = [SWORD_CARD, AMBUSH_CARD]
  eyrie.hand = [{ id: 'ROOT-224#2', defId: 'ROOT-224' }]
  return game
}

function placeUnusedWorkshops(game: Game, count: number): void {
  for (let index = 0; index < count; index++) {
    game.state.clearings[FOX_CLEARING]?.pieces.push({
      id: `test-workshop-${String(index)}`,
      kind: 'building',
      owner: 0,
      type: 'workshop',
      used: false,
    })
  }
}

describe('missingCraftCost', () => {
  it('names each cost suit no crafting piece covers', () => {
    expect(missingCraftCost(['fox', 'fox'], ['fox', 'mouse'])).toEqual(['fox'])
    expect(missingCraftCost(['fox', 'fox'], ['fox', 'fox'])).toEqual([])
  })

  it('pays a wild cost with any piece left after the suited costs', () => {
    expect(missingCraftCost(['wild', 'fox'], ['fox', 'mouse'])).toEqual([])
    expect(missingCraftCost(['wild', 'fox'], ['fox'])).toEqual(['wild'])
  })
})

describe('lookUpCardDetails', () => {
  it('describes the whole hand when no card is named', () => {
    const game = createGameWithHands()

    const lookup = lookUpCardDetails(game, FIRST_TEST_PLAYER_ID, [])

    expect(lookup?.cards).toEqual([
      {
        cardId: SWORD_CARD.id,
        name: 'Sword',
        suit: 'mouse',
        type: 'item',
        description: 'Craft sword item, score +2 VP, then discard.',
        craft: {
          cost: ['fox', 'fox'],
          gives: 'item:sword',
          victoryPoints: 2,
          craftableNow: false,
          missing: ['fox', 'fox'],
          yourCraftingPieces: { fox: 0, rabbit: 0, mouse: 0 },
        },
        legalUsesNow: [],
      },
      expect.objectContaining({ cardId: AMBUSH_CARD.id, type: 'ambush' }),
    ])
    expect(lookup?.cards[1]).not.toHaveProperty('craft')
  })

  it('counts the unused crafting pieces toward the cost', () => {
    const game = createGameWithHands()
    placeUnusedWorkshops(game, 2)

    const lookup = lookUpCardDetails(game, FIRST_TEST_PLAYER_ID, [
      SWORD_CARD.id,
    ])

    expect(lookup?.cards[0]?.craft).toMatchObject({
      missing: [],
      yourCraftingPieces: { fox: 2, rabbit: 0, mouse: 0 },
    })
  })

  it('says why a craft gives nothing when the item left the supply', () => {
    const game = createGameWithHands()
    game.state.itemSupply.sword = 0

    const lookup = lookUpCardDetails(game, FIRST_TEST_PLAYER_ID, [
      SWORD_CARD.id,
    ])

    expect(lookup?.cards[0]?.craft?.blockedBecause).toContain('supply')
  })

  it('names the legal actions that may take the card right now', () => {
    const game = createGameWithHands()
    game.legalActions = (): ReturnType<Game['legalActions']> => [
      { type: 'craft', actor: 0, params: { cardIds: [SWORD_CARD.id] } },
      {
        type: 'overwork',
        actor: 0,
        params: { options: [{ cardId: SWORD_CARD.id, clearing: 1 }] },
      },
      { type: 'endPhase', actor: 0 },
    ]

    const lookup = lookUpCardDetails(game, FIRST_TEST_PLAYER_ID, [
      SWORD_CARD.id,
    ])

    expect(lookup?.cards[0]?.legalUsesNow).toEqual(['craft', 'overwork'])
    expect(lookup?.cards[0]?.craft?.craftableNow).toBe(true)
  })

  it('never describes a card of another hand', () => {
    const game = createGameWithHands()

    const lookup = lookUpCardDetails(game, FIRST_TEST_PLAYER_ID, [
      'ROOT-224#2',
    ])

    expect(lookup).toEqual({ cards: [], unknownCardIds: ['ROOT-224#2'] })
  })

  it('answers nothing to a player without a seat', () => {
    expect(
      lookUpCardDetails(createGameWithHands(), 'stranger', []),
    ).toBeNull()
    expect(
      lookUpCardDetails(createGameWithHands(), SECOND_TEST_PLAYER_ID, [])
        ?.cards,
    ).toHaveLength(1)
  })
})
