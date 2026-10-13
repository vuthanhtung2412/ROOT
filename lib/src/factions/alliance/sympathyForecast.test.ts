import { describe, expect, it } from 'vitest'
import type { Card } from '#cards/types.js'
import { forecastSympathy } from '#factions/alliance/sympathyForecast.js'
import { FALL } from '#map/fall.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { createFactionBoard } from '#state/boards.js'
import type { GameState } from '#state/types.js'
import { card, minimalState, player, withPieces } from '#test/fixtures.js'

const MARQUISE_SEAT: Seat = 0
const ALLIANCE_SEAT: Seat = 1
const SYMPATHETIC_CLEARING: ClearingId = 0
const SYMPATHETIC_SUIT: Suit = FALL.clearings[SYMPATHETIC_CLEARING]!.suit
/** Ambush cards: one bird, one fox. */
const BIRD_CARD: Card = card('ROOT-200')
const SECOND_BIRD_CARD: Card = card('ROOT-200', 2)
const MARTIAL_LAW_WARRIOR_COUNT = 3

const SYMPATHY: Piece = {
  id: 'sympathy',
  kind: 'token',
  type: 'sympathy',
  owner: ALLIANCE_SEAT,
}

function allianceState(supporters: Card[]): GameState {
  const board = createFactionBoard('alliance')
  if (board.kind !== 'alliance') throw new Error('fixture: Alliance board')
  return minimalState({
    factions: ['marquise', 'alliance'],
    players: [
      player(MARQUISE_SEAT, 'marquise'),
      player(ALLIANCE_SEAT, 'alliance', { board: { ...board, supporters } }),
    ],
  })
}

function marquiseWarriors(count: number): Piece[] {
  return Array.from(
    { length: count },
    (_unused, index: number): Piece => ({
      id: `marquise-warrior-${String(index)}`,
      kind: 'warrior',
      owner: MARQUISE_SEAT,
    }),
  )
}

describe('forecastSympathy', () => {
  it('Rule: 8.4.2 — with no sympathy on the map, every clearing is a target', () => {
    const result = forecastSympathy(allianceState([BIRD_CARD]), ALLIANCE_SEAT)

    expect(result.nextTokenCost).toBe(1)
    expect(result.spreadTargets).toHaveLength(FALL.clearings.length)
    expect(result.spreadTargets.every((target) => target.affordable)).toBe(true)
    expect(result.matchingSupportersBySuit).toEqual({
      fox: 1,
      rabbit: 1,
      mouse: 1,
    })
  })

  it('Rule: 8.4.2 — later tokens go next to a sympathetic clearing only', () => {
    const state = withPieces(allianceState([BIRD_CARD]), SYMPATHETIC_CLEARING, [
      SYMPATHY,
    ])

    const result = forecastSympathy(state, ALLIANCE_SEAT)

    expect(result.sympatheticClearings).toEqual([SYMPATHETIC_CLEARING])
    expect(result.spreadTargets.map((target) => target.clearing)).toEqual(
      FALL.adjacent(SYMPATHETIC_CLEARING).toSorted(
        (first: ClearingId, second: ClearingId): number => first - second,
      ),
    )
  })

  it('Rule: 8.4.2.II.a Martial Law — three enemy warriors add one supporter to the cost', () => {
    const target: ClearingId = FALL.adjacent(SYMPATHETIC_CLEARING)[0]!
    const state = withPieces(
      withPieces(allianceState([BIRD_CARD]), SYMPATHETIC_CLEARING, [SYMPATHY]),
      target,
      marquiseWarriors(MARTIAL_LAW_WARRIOR_COUNT),
    )

    const result = forecastSympathy(state, ALLIANCE_SEAT)

    expect(
      result.spreadTargets.find((candidate) => candidate.clearing === target),
    ).toMatchObject({ supporterCost: 2, martialLaw: true, affordable: false })
  })

  it('Rule: 8.4.1 — a revolt needs two matching supporters and the base on the board', () => {
    const sympathetic = (supporters: Card[]): GameState =>
      withPieces(allianceState(supporters), SYMPATHETIC_CLEARING, [SYMPATHY])

    expect(
      forecastSympathy(sympathetic([BIRD_CARD]), ALLIANCE_SEAT).revoltTargets,
    ).toEqual([
      {
        clearing: SYMPATHETIC_CLEARING,
        suit: SYMPATHETIC_SUIT,
        supporterCost: 2,
        affordable: false,
      },
    ])
    expect(
      forecastSympathy(
        sympathetic([BIRD_CARD, SECOND_BIRD_CARD]),
        ALLIANCE_SEAT,
      ).revoltTargets[0]?.affordable,
    ).toBe(true)
  })
})
