import { describe, expect, it } from 'vitest'
import type { GameState } from '@root/lib'
import { createTwoPlayerGameState } from '#test/gameStateFixtures.js'
import { redactStateForViewer } from '#view/redactStateForViewer.js'

describe('redactStateForViewer', () => {
  it('keeps viewer hand and empties opponent hand', () => {
    const state = createTwoPlayerGameState([
      {
        playerId: 'marquise',
        hand: [
          { id: 'c1', defId: 'fox_ambush' },
          { id: 'c2', defId: 'bird_armorers' },
        ],
      },
      {
        playerId: 'eyrie',
        hand: [
          { id: 'c3', defId: 'mouse_ambush' },
          { id: 'c4', defId: 'rabbit_boat' },
        ],
      },
    ])

    const forMarquise = redactStateForViewer(state, 'marquise')

    expect(forMarquise.players[0]?.hand).toEqual([
      { id: 'c1', defId: 'fox_ambush' },
      { id: 'c2', defId: 'bird_armorers' },
    ])
    expect(forMarquise.players[1]?.hand).toEqual([])
    expect(state.players[1]?.hand).toHaveLength(2)
  })

  it('does not mutate clearing pieces', () => {
    const state = createTwoPlayerGameState([
      {
        playerId: 'marquise',
        hand: [{ id: 'c1', defId: 'fox_ambush' }],
      },
      {
        playerId: 'eyrie',
        hand: [{ id: 'c2', defId: 'mouse_ambush' }],
      },
    ])
    const piece: { id: string; kind: 'warrior'; owner: 0 } = {
      id: 'w1',
      kind: 'warrior',
      owner: 0,
    }
    const withPiece: GameState = {
      ...state,
      clearings: state.clearings.map((clearing, index) =>
        index === 0 ? { pieces: [piece] } : clearing,
      ),
    }

    const redacted = redactStateForViewer(withPiece, 'eyrie')

    expect(redacted.clearings[0]?.pieces).toEqual([piece])
    expect(redacted.clearings[0]?.pieces[0]).toBe(piece)
  })
})
