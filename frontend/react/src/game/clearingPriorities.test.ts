import { describe, expect, it } from 'vitest'
import { botClearingPriorities } from '#game/clearingPriorities.ts'

const FALL_CORNER_IDS: readonly number[] = [0, 1, 2, 3]

describe('botClearingPriorities', () => {
  it('numbers the Fall clearings like the printed map (id 0 → 1) when a bot plays', () => {
    const priorities = botClearingPriorities(['alliance', 'mechanicalMarquise'], FALL_CORNER_IDS)

    expect([...priorities.entries()]).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ])
  })

  it('shows none without a bot, AI players included', () => {
    expect(botClearingPriorities(['marquise', 'eyrie'], FALL_CORNER_IDS).size).toBe(0)
  })
})
