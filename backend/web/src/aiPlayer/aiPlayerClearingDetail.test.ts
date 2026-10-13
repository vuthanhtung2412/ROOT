import { describe, expect, it } from 'vitest'
import { FALL } from '@root/lib'
import { describeClearing } from '#aiPlayer/aiPlayerClearingDetail.js'
import {
  createPlayingTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
  SECOND_TEST_PLAYER_ID,
} from '#test/gameStateFixtures.js'

/** Fixture setup: the Marquise keep stands in clearing 0, the roost in 2. */
const KEEP_CLEARING = 0
const ROOST_CLEARING = 2
const EYRIE_STARTING_WARRIORS = 6

describe('describeClearing', () => {
  it('lists the pieces per faction, the ruler and the free slots', () => {
    const game = createPlayingTwoPlayerGame()

    const detail = describeClearing(game, FIRST_TEST_PLAYER_ID, ROOST_CLEARING)

    expect(detail).toMatchObject({
      id: ROOST_CLEARING,
      suit: FALL.clearings[ROOST_CLEARING]?.suit,
      ruler: 'eyrie',
      pieces: {
        eyrie: {
          warriors: EYRIE_STARTING_WARRIORS,
          buildings: ['roost'],
          tokens: [],
          pawn: false,
        },
      },
    })
    expect(detail?.pieces.marquise).toBeUndefined()
    expect(detail?.slots.free).toBe((detail?.slots.total ?? 0) - 1)
  })

  it('names each adjacent clearing with its suit and ruler', () => {
    const game = createPlayingTwoPlayerGame()

    const detail = describeClearing(game, FIRST_TEST_PLAYER_ID, KEEP_CLEARING)

    expect(detail?.ruler).toBe('marquise')
    expect(detail?.pieces.marquise?.tokens).toContain('keep')
    expect(detail?.adjacent.map((neighbor) => neighbor.id)).toEqual(
      FALL.adjacent(KEEP_CLEARING),
    )
    expect(detail?.adjacent[0]).toMatchObject({
      suit: FALL.clearings[FALL.adjacent(KEEP_CLEARING)[0] ?? 0]?.suit,
      ruler: 'marquise',
    })
  })

  it('names the legal actions of the seat that touch the clearing', () => {
    const game = createPlayingTwoPlayerGame()

    const acting = describeClearing(game, FIRST_TEST_PLAYER_ID, KEEP_CLEARING)
    const waiting = describeClearing(game, SECOND_TEST_PLAYER_ID, KEEP_CLEARING)

    expect(acting?.legalActionsHereNow).toContain('march')
    expect(waiting?.legalActionsHereNow).toEqual([])
  })

  it('knows no clearing outside the map', () => {
    expect(
      describeClearing(
        createPlayingTwoPlayerGame(),
        FIRST_TEST_PLAYER_ID,
        FALL.clearings.length,
      ),
    ).toBeNull()
  })
})
