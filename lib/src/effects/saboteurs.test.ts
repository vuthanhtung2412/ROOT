import { describe, expect, it } from 'vitest'
import type { ActionSpec } from '#actions/types.js'
import '#effects/register.js'
import type { Game } from '#game/Game.js'
import { RuleError } from '#rules/RuleError.js'
import { card, createPlayingGame } from '#test/fixtures.js'

describe('Saboteurs', () => {
  it('Rule: Saboteurs — discard self to discard enemy crafted card', () => {
    const game = createPlayingGame({ seed: 29 })

    const saboteur = card('ROOT-93')
    const enemyCraft = card('ROOT-57')
    game.state.players[0]!.playArea.push(saboteur)
    game.state.players[1]!.playArea.push(enemyCraft)

    expect(game.state.phase).toBe('birdsong')
    expect(game.legalActions().some((spec) => spec.type === 'saboteurs')).toBe(true)
    game.apply({ type: 'saboteurs', target: 1, cardId: enemyCraft.id })

    expect(game.state.players[0]!.playArea.some((playCard) => playCard.id === saboteur.id)).toBe(
      false,
    )
    expect(game.state.players[1]!.playArea.some((playCard) => playCard.id === enemyCraft.id)).toBe(
      false,
    )
    expect(game.state.deck.discard.some((discardCard) => discardCard.id === saboteur.id)).toBe(
      true,
    )
    expect(game.state.deck.discard.some((discardCard) => discardCard.id === enemyCraft.id)).toBe(
      true,
    )
  })
})

const SABOTEURS_DEF_ID = 'ROOT-93'
const SWAP_MEET_DEF_ID = 'ROOT-103'
const BOAT_BUILDERS_DEF_ID = 'ROOT-57'
const TUNNELS_DEF_ID = 'ROOT-108'
const OWNER_SEAT = 0
const ENEMY_SEAT = 1

/** Marquise Birdsong; she owns Saboteurs and Swap Meet, the Eyrie two crafted cards. */
function saboteursGame(): Game {
  const game: Game = createPlayingGame({ seed: 29 })
  const owner = game.state.players[OWNER_SEAT]!
  const enemy = game.state.players[ENEMY_SEAT]!
  owner.playArea.push(card(SABOTEURS_DEF_ID), card(SWAP_MEET_DEF_ID))
  owner.hand.push(card('ROOT-209'))
  enemy.playArea.push(card(BOAT_BUILDERS_DEF_ID), card(TUNNELS_DEF_ID))
  enemy.hand = [card('ROOT-224')]
  return game
}

function saboteursSpec(game: Game): ActionSpec | undefined {
  return game
    .legalActions()
    .find((spec: ActionSpec): boolean => spec.type === 'saboteurs')
}

describe('Saboteurs — card text: "At the start of Birdsong"', () => {
  it('lists every crafted card of every enemy as a legal payload', () => {
    const game: Game = saboteursGame()

    expect(saboteursSpec(game)).toEqual({
      type: 'saboteurs',
      actor: OWNER_SEAT,
      params: {
        options: [
          { target: ENEMY_SEAT, cardId: card(BOAT_BUILDERS_DEF_ID).id },
          { target: ENEMY_SEAT, cardId: card(TUNNELS_DEF_ID).id },
        ],
      },
    })
  })

  it('is no longer offered once the owner took another Birdsong action', () => {
    const game: Game = saboteursGame()

    game.apply({ type: 'swapMeet', target: ENEMY_SEAT })
    game.apply({ type: 'resolveEvent', cardId: 'ROOT-209#1' })

    expect(game.state.phase).toBe('birdsong')
    expect(game.state.pending).toEqual([])
    expect(saboteursSpec(game)).toBeUndefined()
    expect(() =>
      game.apply({
        type: 'saboteurs',
        target: ENEMY_SEAT,
        cardId: card(TUNNELS_DEF_ID).id,
      }),
    ).toThrow(RuleError)
  })

  it('does not end the start of Birdsong itself: other Birdsong actions stay', () => {
    const game: Game = saboteursGame()

    game.apply({
      type: 'saboteurs',
      target: ENEMY_SEAT,
      cardId: card(TUNNELS_DEF_ID).id,
    })

    expect(
      game.legalActions().some((spec: ActionSpec): boolean => spec.type === 'swapMeet'),
    ).toBe(true)
  })

  it('a new phase starts with no action taken in it', () => {
    const game: Game = saboteursGame()
    game.apply({ type: 'swapMeet', target: ENEMY_SEAT })
    game.apply({ type: 'resolveEvent', cardId: 'ROOT-209#1' })
    expect(game.state.turnScratch.phaseActionTaken).toBe(true)

    game.apply({ type: 'endPhase' })

    expect(game.state.phase).toBe('daylight')
    expect(game.state.turnScratch.phaseActionTaken).toBe(false)
  })
})
