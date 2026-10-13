import { describe, expect, it } from 'vitest'
import { Game } from '@root/lib'
import { forecastOwnFaction } from '#aiPlayer/aiPlayerFactionForecast.js'
import {
  createPlayingTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
  SECOND_TEST_PLAYER_ID,
} from '#test/gameStateFixtures.js'

const ALLIANCE_PLAYER_ID = 'alliance-player'

/** Marquise (seat 0) vs Alliance (seat 1), setup still pending. */
function createGameWithAlliance(): Game {
  const game = Game.create({ seed: 1, factions: ['marquise', 'alliance'] })
  game.join(FIRST_TEST_PLAYER_ID)
  game.join(ALLIANCE_PLAYER_ID)
  game.start()
  return game
}

describe('forecastOwnFaction', () => {
  it('gives the Marquise their wood, building costs and build sites', () => {
    const forecast = forecastOwnFaction(
      createPlayingTwoPlayerGame(),
      FIRST_TEST_PLAYER_ID,
      'marquise',
    )

    expect(forecast).toMatchObject({
      buildings: [
        { building: 'sawmill' },
        { building: 'workshop' },
        { building: 'recruiter' },
      ],
      note: expect.stringContaining('As the map stands now'),
    })
    expect(forecast).toHaveProperty('ruledClearings')
  })

  it('gives the Alliance their sympathy targets and supporter counts', () => {
    const forecast = forecastOwnFaction(
      createGameWithAlliance(),
      ALLIANCE_PLAYER_ID,
      'alliance',
    )

    expect(forecast).toMatchObject({ nextTokenCost: 1, sympatheticClearings: [] })
    expect(forecast).toHaveProperty('matchingSupportersBySuit')
  })

  it('answers nothing to another faction: supporters stay face down', () => {
    const game = createGameWithAlliance()

    expect(forecastOwnFaction(game, FIRST_TEST_PLAYER_ID, 'alliance')).toBeNull()
    expect(
      forecastOwnFaction(
        createPlayingTwoPlayerGame(),
        SECOND_TEST_PLAYER_ID,
        'marquise',
      ),
    ).toBeNull()
    expect(forecastOwnFaction(game, 'stranger', 'marquise')).toBeNull()
  })
})
