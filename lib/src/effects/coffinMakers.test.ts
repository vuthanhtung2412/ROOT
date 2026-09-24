import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { removePieces } from '#rules/remove.js'
import {
  buildCraftContext,
  card,
  marquiseBoard,
  minimalState,
  player,
  withPieces,
} from '#test/fixtures.js'

describe('Coffin Makers', () => {
  it('Rule: Coffin Makers — warriors to supply pile on card', () => {
    const coffin = card('ROOT-62')
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise', { playArea: [coffin], board: marquiseBoard() }),
          player(1, 'marquise', { board: marquiseBoard() }),
        ],
      }),
      4,
      [
        { id: 'w0', kind: 'warrior', owner: 0 },
        { id: 'w1a', kind: 'warrior', owner: 1 },
        { id: 'w1b', kind: 'warrior', owner: 1 },
        { id: 'w1c', kind: 'warrior', owner: 1 },
        { id: 'w1d', kind: 'warrior', owner: 1 },
        { id: 'w1e', kind: 'warrior', owner: 1 },
      ],
    )
    const supplyBefore = (() => {
      const board = state.players[1]!.board
      if (board.kind !== 'marquise') throw new Error('expected marquise')
      return board.supply.warriors
    })()
    const ctx = buildCraftContext(state)
    removePieces(state, {
      clearing: 4,
      pieceIds: ['w1a', 'w1b', 'w1c', 'w1d', 'w1e'],
      scorer: 0,
      options: { skipFieldHospital: true },
    }, ctx)

    expect(coffin.heldWarriors).toBe(5)
    const board = state.players[1]!.board
    if (board.kind !== 'marquise') throw new Error('expected marquise')
    expect(board.supply.warriors).toBe(supplyBefore)
  })

  it('Rule: Coffin Makers — Birdsong scores one VP per five warriors', () => {
    const coffin = card('ROOT-62')
    coffin.heldWarriors = 11
    const state = minimalState({
      players: [
        player(0, 'marquise', { playArea: [coffin], vp: 0 }),
        player(1, 'marquise'),
      ],
      currentSeat: 0,
      phase: 'birdsong',
    })
    const ctx = buildCraftContext(state)
    ctx.emit({ s: 'phase.start', actor: 0, phase: 'birdsong' })
    expect(state.players[0]!.vp).toBe(2)
    expect(coffin.heldWarriors).toBe(0)
  })
})
