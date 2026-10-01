import { describe, expect, it } from 'vitest'
import { refreshItems } from '#factions/vagabond/items.js'
import { createFactionBoard, type VagabondBoard } from '#state/boards.js'

function emptyVagabondBoard(): VagabondBoard {
  const board = createFactionBoard('vagabond')
  if (board.kind !== 'vagabond') throw new Error('expected vagabond board')
  return {
    ...board,
    satchel: [],
    tracks: { tea: [], coin: [], bag: [] },
    damaged: [],
  }
}

describe('refreshItems', () => {
  it('Rule: 9.4.1 Refresh — flips exhausted items in the Damaged box face up', () => {
    const board: VagabondBoard = {
      ...emptyVagabondBoard(),
      satchel: [{ type: 'sword', exhausted: true }],
      damaged: [{ type: 'boot', exhausted: true }],
    }
    const refreshedCount: number = refreshItems(board, 3)
    expect(refreshedCount).toBe(2)
    expect(board.satchel).toEqual([{ type: 'sword', exhausted: false }])
    expect(board.damaged).toEqual([{ type: 'boot', exhausted: false }])
  })

  it('Rule: 9.4.1 Refresh — undamaged items are refreshed before damaged ones', () => {
    const board: VagabondBoard = {
      ...emptyVagabondBoard(),
      satchel: [{ type: 'sword', exhausted: true }],
      damaged: [{ type: 'boot', exhausted: true }],
    }
    refreshItems(board, 1)
    expect(board.satchel).toEqual([{ type: 'sword', exhausted: false }])
    expect(board.damaged).toEqual([{ type: 'boot', exhausted: true }])
  })
})
