import { describe, expect, it } from 'vitest'
import {
  buildStandings,
  VICTORY_POINT_GOAL,
} from '#aiPlayer/aiPlayerStandings.js'
import {
  createPlayingTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
  SECOND_TEST_PLAYER_ID,
} from '#test/gameStateFixtures.js'

const MARQUISE_SEAT = 0
const EYRIE_SEAT = 1
const EYRIE_STARTING_WARRIORS = 6
const THREE_ROOSTS_VICTORY_POINTS = 2

describe('buildStandings', () => {
  it('ranks the players by score and counts what each has on the map', () => {
    const game = createPlayingTwoPlayerGame()
    const eyrie = game.state.players[EYRIE_SEAT]
    if (eyrie === undefined) throw new Error('fixture: the Eyrie seat is missing')
    eyrie.vp = 4

    const standings = buildStandings(game, FIRST_TEST_PLAYER_ID)

    expect(standings?.goal).toBe(VICTORY_POINT_GOAL)
    expect(standings?.players).toMatchObject([
      {
        faction: 'eyrie',
        seat: EYRIE_SEAT,
        you: false,
        victoryPoints: 4,
        victoryPointsToGoal: VICTORY_POINT_GOAL - 4,
        handSize: eyrie.hand.length,
        warriorsOnMap: EYRIE_STARTING_WARRIORS,
        buildingsOnMap: { roost: 1 },
      },
      {
        faction: 'marquise',
        seat: MARQUISE_SEAT,
        you: true,
        buildingsOnMap: { sawmill: 1, workshop: 1, recruiter: 1 },
        tokensOnMap: { keep: 1 },
      },
    ])
  })

  it('Rule: 7.6.1 — the Eyrie are sure of their roost points next Evening', () => {
    const game = createPlayingTwoPlayerGame()
    for (const clearing of [5, 6]) {
      game.state.clearings[clearing]?.pieces.push({
        id: `test-roost-${String(clearing)}`,
        kind: 'building',
        owner: EYRIE_SEAT,
        type: 'roost',
        used: false,
      })
    }

    const standings = buildStandings(game, SECOND_TEST_PLAYER_ID)

    expect(
      standings?.players.find((player) => player.faction === 'eyrie')
        ?.sureVictoryPointsNextEvening,
    ).toEqual({
      points: THREE_ROOSTS_VICTORY_POINTS,
      from: '3 roosts on the map at Evening',
    })
    expect(
      standings?.players.find((player) => player.faction === 'marquise')
        ?.sureVictoryPointsNextEvening,
    ).toBeUndefined()
  })

  it('shows the supply of the asking seat and never a card of a hand', () => {
    const game = createPlayingTwoPlayerGame()

    const standings = buildStandings(game, SECOND_TEST_PLAYER_ID)

    expect(standings?.yourSupply).toHaveProperty('warriors')
    for (const card of game.state.players[MARQUISE_SEAT]?.hand ?? []) {
      expect(JSON.stringify(standings)).not.toContain(card.id)
    }
    expect(JSON.stringify(standings)).not.toContain(FIRST_TEST_PLAYER_ID)
  })

  it('answers nothing to a player without a seat', () => {
    expect(buildStandings(createPlayingTwoPlayerGame(), 'stranger')).toBeNull()
  })
})
