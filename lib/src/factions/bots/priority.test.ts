import { describe, expect, it } from 'vitest'
import {
  baseFactionOf,
  isBotFaction,
  isBotSeat,
} from '#factions/bots/botFactions.js'
import {
  byHighestPriority,
  byLowestPriority,
  byMost,
  bySetupPriority,
  clearingPriority,
  inTargetOrder,
} from '#factions/bots/priority.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { minimalState, player } from '#test/fixtures.js'

describe('bot factions', () => {
  it('knows the two bots and the faction whose art they use', () => {
    expect(isBotFaction('mechanicalMarquise')).toBe(true)
    expect(isBotFaction('electricEyrie')).toBe(true)
    expect(isBotFaction('marquise')).toBe(false)
    expect(baseFactionOf('mechanicalMarquise')).toBe('marquise')
    expect(baseFactionOf('electricEyrie')).toBe('eyrie')
    expect(baseFactionOf('alliance')).toBe('alliance')
  })

  it('tells bot seats from human seats', () => {
    const state = minimalState({
      factions: ['marquise', 'electricEyrie'],
      players: [player(0, 'marquise'), player(1, 'electricEyrie')],
    })
    expect(isBotSeat(state, 0)).toBe(false)
    expect(isBotSeat(state, 1)).toBe(true)
  })
})

describe('target priority (Rootbotics 2.1, 2.2)', () => {
  it('marks Fall clearing id 0 as priority 1 and id 11 as 12', () => {
    expect(clearingPriority(0)).toBe(1)
    expect(clearingPriority(11)).toBe(12)
  })

  it('orders clearings by highest or lowest priority', () => {
    const clearings: ClearingId[] = [7, 2, 11]
    expect(inTargetOrder(clearings, [byHighestPriority])).toEqual([2, 7, 11])
    expect(inTargetOrder(clearings, [byLowestPriority])).toEqual([11, 7, 2])
  })

  it('uses later tiebreakers only to break ties of earlier ones', () => {
    const enemyPieces: Readonly<Record<number, number>> = { 3: 2, 5: 4, 8: 4 }
    const order = inTargetOrder<ClearingId>(
      [3, 8, 5],
      [
        byMost((clearing: ClearingId): number => enemyPieces[clearing] ?? 0),
        byHighestPriority,
      ],
    )
    expect(order).toEqual([5, 8, 3])
  })

  it('falls back to setup priority among players, Marquise first', () => {
    const state = minimalState({
      factions: ['alliance', 'electricEyrie', 'mechanicalMarquise'],
      players: [
        player(0, 'alliance'),
        player(1, 'electricEyrie'),
        player(2, 'mechanicalMarquise'),
      ],
    })
    const seats: Seat[] = [0, 1, 2]
    expect(inTargetOrder(seats, [bySetupPriority(state)])).toEqual([2, 1, 0])
  })
})
