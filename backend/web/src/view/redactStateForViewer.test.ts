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

  it('Rule: 11.2.3 Public Hand — the Riverfolk hand stays visible to others', () => {
    const riverfolkHand = [{ id: 'c3', defId: 'mouse_ambush' }]
    const state = createTwoPlayerGameState([
      { playerId: 'marquise', hand: [] },
      { playerId: 'riverfolk', hand: riverfolkHand },
    ])
    state.players[1]!.faction = 'riverfolk'

    const forMarquise = redactStateForViewer(state, 'marquise')

    expect(forMarquise.players[1]?.hand).toEqual(riverfolkHand)
    expect(forMarquise.players[1]?.playerId).toBe('hidden-seat-1')
  })

  it('hides other seats join ids so they cannot be reused', () => {
    const state = createTwoPlayerGameState([
      { playerId: 'marquise-secret', hand: [] },
      { playerId: 'eyrie-secret', hand: [] },
    ])

    const forMarquise = redactStateForViewer(state, 'marquise-secret')

    expect(forMarquise.players[0]?.playerId).toBe('marquise-secret')
    expect(forMarquise.players[1]?.playerId).toBe('hidden-seat-1')
    expect(JSON.stringify(forMarquise)).not.toContain('eyrie-secret')
  })

  it('hides draw pile order, quest deck order and seed but keeps pile sizes', () => {
    const state = createTwoPlayerGameState([
      { playerId: 'marquise-secret', hand: [] },
      { playerId: 'eyrie-secret', hand: [] },
    ])
    const withDeck: GameState = {
      ...state,
      seed: 4242,
      deck: {
        ...state.deck,
        draw: [
          { id: 'ROOT-1#1', defId: 'ROOT-1' },
          { id: 'ROOT-2#1', defId: 'ROOT-2' },
        ],
      },
    }

    const redacted = redactStateForViewer(withDeck, 'eyrie-secret')

    expect(redacted.seed).toBe(0)
    expect(redacted.deck.draw).toHaveLength(2)
    expect(JSON.stringify(redacted.deck.draw)).not.toContain('ROOT-')
    expect(redacted.questDeck).toHaveLength(withDeck.questDeck.length)
    expect(redacted.deck.discard).toBe(withDeck.deck.discard)
    expect(withDeck.deck.draw[0]?.defId).toBe('ROOT-1')
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
