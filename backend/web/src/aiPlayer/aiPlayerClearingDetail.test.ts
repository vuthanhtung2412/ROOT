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
/** Two starting Marquise buildings fill both slots of clearing 4. */
const FULL_CLEARING = 4
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

  it('says whether the seat can move out of or build in the clearing, and why not', () => {
    const game = createPlayingTwoPlayerGame()

    const ownRuled = FALL.clearings
      .map((_clearing, clearingId: number) =>
        describeClearing(game, FIRST_TEST_PLAYER_ID, clearingId),
      )
      .find(
        (detail) =>
          detail?.ruler === 'marquise' &&
          detail.slots.free > 0 &&
          detail.pieces.marquise?.tokens.length === 0,
      )
    const fullClearing = describeClearing(
      game,
      FIRST_TEST_PLAYER_ID,
      FULL_CLEARING,
    )
    const enemyRuled = describeClearing(
      game,
      FIRST_TEST_PLAYER_ID,
      ROOST_CLEARING,
    )
    const keepForEyrie = describeClearing(
      game,
      SECOND_TEST_PLAYER_ID,
      KEEP_CLEARING,
    )
    const ownRoost = describeClearing(
      game,
      SECOND_TEST_PLAYER_ID,
      ROOST_CLEARING,
    )

    expect(ownRuled?.youCanMoveFromHere).toBe(true)
    expect(ownRuled?.youCanBuildHere).toBe(true)
    expect(ownRuled).not.toHaveProperty('whyNotBuild')
    expect(fullClearing?.slots.free).toBe(0)
    expect(fullClearing?.whyNotBuild).toBe(
      'no free building slot in this clearing',
    )
    expect(enemyRuled).toMatchObject({
      youCanMoveFromHere: false,
      whyNotBuild: 'you do not rule this clearing',
    })
    expect(keepForEyrie?.whyNotBuild).toContain('keep')
    expect(ownRoost?.whyNotBuild).toBe('you already have a roost here')
  })

  it('reports a build as possible when a legal build names the clearing', () => {
    const game = createPlayingTwoPlayerGame()
    const target = FALL.adjacent(KEEP_CLEARING)[0] ?? 0
    game.legalActions = (): ReturnType<typeof game.legalActions> => [
      {
        type: 'build',
        actor: 0,
        params: { options: [{ clearing: target, building: 'sawmill' }] },
      },
    ]

    const detail = describeClearing(game, FIRST_TEST_PLAYER_ID, target)

    expect(detail?.youCanBuildHere).toBe(true)
    expect(detail).not.toHaveProperty('whyNotBuild')
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
