import { describe, expect, it } from 'vitest'
import type { ActionSpec } from '#actions/types.js'
import type { Card } from '#cards/types.js'
import '#effects/register.js'
import type { Game } from '#game/Game.js'
import { RuleError } from '#rules/RuleError.js'
import { card, createPlayingGame } from '#test/fixtures.js'

const SWAP_MEET_DEF_ID = 'ROOT-103'
const OWNER_SEAT = 0
const TARGET_SEAT = 1
const OWNER_CARD: Card = card('ROOT-209')
const TARGET_CARD: Card = card('ROOT-211', 2)

/** Marquise Birdsong with Swap Meet; each player holds exactly one card. */
function swapMeetGame(): Game {
  const game: Game = createPlayingGame({ seed: 5 })
  const owner = game.state.players[OWNER_SEAT]!
  owner.playArea.push(card(SWAP_MEET_DEF_ID))
  owner.hand = [OWNER_CARD]
  game.state.players[TARGET_SEAT]!.hand = [TARGET_CARD]
  return game
}

function handIds(game: Game, seat: number): string[] {
  return game.state.players[seat]!.hand.map((handCard: Card): string => handCard.id)
}

function swapMeetSpec(game: Game): ActionSpec | undefined {
  return game
    .legalActions()
    .find((spec: ActionSpec): boolean => spec.type === 'swapMeet')
}

describe('Swap Meet — "take a random card from another player and then give them a card"', () => {
  it('lists every other player holding a card as a legal payload', () => {
    const game: Game = swapMeetGame()

    expect(swapMeetSpec(game)).toEqual({
      type: 'swapMeet',
      actor: OWNER_SEAT,
      params: { options: [{ target: TARGET_SEAT }] },
    })
  })

  it('takes the card first, then asks which card to give', () => {
    const game: Game = swapMeetGame()

    game.apply({ type: 'swapMeet', target: TARGET_SEAT })

    expect(handIds(game, OWNER_SEAT)).toEqual([OWNER_CARD.id, TARGET_CARD.id])
    expect(handIds(game, TARGET_SEAT)).toEqual([])
    expect(game.state.pending).toEqual([
      { type: 'swapMeetGive', seat: OWNER_SEAT, target: TARGET_SEAT },
    ])
    expect(game.legalActions()).toEqual([
      {
        type: 'resolveEvent',
        actor: OWNER_SEAT,
        params: { cardIds: [OWNER_CARD.id, TARGET_CARD.id] },
      },
    ])
  })

  it('gives the chosen card to the player the card was taken from', () => {
    const game: Game = swapMeetGame()
    game.apply({ type: 'swapMeet', target: TARGET_SEAT })

    game.apply({ type: 'resolveEvent', cardId: OWNER_CARD.id })

    expect(handIds(game, OWNER_SEAT)).toEqual([TARGET_CARD.id])
    expect(handIds(game, TARGET_SEAT)).toEqual([OWNER_CARD.id])
    expect(game.state.pending).toEqual([])
  })

  it('may give back the card that was just taken', () => {
    const game: Game = swapMeetGame()
    game.apply({ type: 'swapMeet', target: TARGET_SEAT })

    game.apply({ type: 'resolveEvent', cardId: TARGET_CARD.id })

    expect(handIds(game, OWNER_SEAT)).toEqual([OWNER_CARD.id])
    expect(handIds(game, TARGET_SEAT)).toEqual([TARGET_CARD.id])
  })

  it('works with an empty hand: the taken card is the one given', () => {
    const game: Game = swapMeetGame()
    game.state.players[OWNER_SEAT]!.hand = []

    game.apply({ type: 'swapMeet', target: TARGET_SEAT })

    expect(game.legalActions()).toEqual([
      {
        type: 'resolveEvent',
        actor: OWNER_SEAT,
        params: { cardIds: [TARGET_CARD.id] },
      },
    ])
  })

  it('cannot give a card that is not in hand', () => {
    const game: Game = swapMeetGame()
    game.apply({ type: 'swapMeet', target: TARGET_SEAT })

    expect(() =>
      game.apply({ type: 'resolveEvent', cardId: card('ROOT-224').id }),
    ).toThrow(RuleError)
  })

  it('Rule: once in Birdsong', () => {
    const game: Game = swapMeetGame()
    game.apply({ type: 'swapMeet', target: TARGET_SEAT })
    game.apply({ type: 'resolveEvent', cardId: OWNER_CARD.id })

    expect(game.state.turnScratch.swapMeetUsed).toBe(true)
    expect(swapMeetSpec(game)).toBeUndefined()
  })
})
