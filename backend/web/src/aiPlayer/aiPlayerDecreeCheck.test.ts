import { describe, expect, it } from 'vitest'
import type { Game, PlayerState } from '@root/lib'
import { checkDecree } from '#aiPlayer/aiPlayerDecreeCheck.js'
import {
  createPlayingTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
  SECOND_TEST_PLAYER_ID,
} from '#test/gameStateFixtures.js'

const EYRIE_SEAT = 1
const SWORD_CARD = { id: 'ROOT-224#1', defId: 'ROOT-224' }

function eyriePlayer(game: Game): PlayerState {
  const player = game.state.players[EYRIE_SEAT]
  if (player === undefined) throw new Error('fixture: the Eyrie seat is missing')
  return player
}

describe('checkDecree', () => {
  it('finds no turmoil risk in the starting Decree', () => {
    const check = checkDecree(createPlayingTwoPlayerGame(), SECOND_TEST_PLAYER_ID, [])

    expect(check?.leader).toBe('builder')
    expect(check?.turmoilRisks).toEqual([])
    expect(check?.victoryPointsLostInTurmoil).toBe(2)
  })

  it('names the column and card that cannot resolve when a hand card is tried', () => {
    const game = createPlayingTwoPlayerGame()
    eyriePlayer(game).hand = [SWORD_CARD]

    const check = checkDecree(game, SECOND_TEST_PLAYER_ID, [
      { cardId: SWORD_CARD.id, column: 'battle' },
    ])

    expect(check?.columns.battle).toContainEqual(
      expect.objectContaining({
        cardId: SWORD_CARD.id,
        adding: true,
        resolvable: false,
      }),
    )
    expect(check?.turmoilRisks).toContainEqual(
      expect.stringContaining('battle: Sword (mouse)'),
    )
    expect(eyriePlayer(game).hand).toEqual([SWORD_CARD])
  })

  it('warns when the recruit column needs more warriors than the supply holds', () => {
    const game = createPlayingTwoPlayerGame()
    const board = eyriePlayer(game).board
    if (board.kind !== 'eyrie') throw new Error('fixture: Eyrie board expected')
    board.supply.warriors = 0

    const check = checkDecree(game, SECOND_TEST_PLAYER_ID, [])

    expect(check?.turmoilRisks).toContainEqual(
      expect.stringContaining('your supply holds 0'),
    )
  })

  it('answers nothing to a seat that is not the Eyrie', () => {
    expect(
      checkDecree(createPlayingTwoPlayerGame(), FIRST_TEST_PLAYER_ID, []),
    ).toBeNull()
  })
})
