import { describe, expect, it } from 'vitest'
import { cardLabel, formatGameView, formatPieceChunk } from './prettyState.js'
import { minimalState, player, withPieces } from '../test/fixtures.js'

describe('formatPieceChunk', () => {
  it('keeps warriors as Nw and collapses wood', () => {
    expect(
      formatPieceChunk([
        'w',
        'w',
        'keep',
        'sawmill',
        'wood',
        'wood',
        'wood',
        'wood',
        'wood',
        'wood',
        'wood',
        'wood',
      ]),
    ).toBe('2w+keep+sawmill+wood x8')
  })

  it('leaves single tokens alone', () => {
    expect(formatPieceChunk(['workshop', 'sawmill', 'wood'])).toBe(
      'workshop+sawmill+wood',
    )
  })
})

describe('cardLabel', () => {
  it('appends truncated effect when asked', () => {
    const label = cardLabel({ id: 'ROOT-64#1', defId: 'ROOT-64' }, { effect: true })
    expect(label).toContain('Corvid Planners')
    expect(label).toContain('(persistent)')
    expect(label).toContain('—')
    expect(label).toContain('ignore rule')
  })
})

describe('formatGameView', () => {
  it('drops game id, keeps seed, renames play→crafted, collapses wood', () => {
    let state = minimalState({
      seed: 42,
      players: [
        player(0, 'marquise', {
          playArea: [{ id: 'ROOT-64#1', defId: 'ROOT-64' }],
        }),
        player(1, 'marquise'),
      ],
    })
    state = withPieces(state, 0, [
      { id: 'w1', kind: 'warrior', owner: 0 },
      { id: 'w2', kind: 'warrior', owner: 0 },
      { id: 'k', kind: 'token', type: 'keep', owner: 0 },
      { id: 's', kind: 'building', type: 'sawmill', owner: 0, used: false },
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `wood-${i}`,
        kind: 'token' as const,
        type: 'wood' as const,
        owner: 0,
      })),
    ])

    const text = formatGameView(state, { label: 'ACT' })
    expect(text).not.toMatch(/\bid=/)
    expect(text).not.toMatch(/seed=/)
    expect(text).toContain('[ACT] turn=1 marquise/p0 daylight/actions (playing)')
    expect(text).toContain('  marquise/p0 VP=0')
    expect(text).toContain('  marquise/p1 VP=0')
    expect(text).not.toMatch(/seat=/)
    expect(text).not.toMatch(/seat\d/)
    expect(text).not.toMatch(/^\s+s\d+:/m)
    expect(text).toContain('crafted:')
    expect(text).not.toMatch(/^\s+play:/m)
    expect(text).toContain('Corvid Planners')
    expect(text).toContain('—')
    expect(text).toContain('2w+keep+sawmill+wood x8')
    expect(text).toContain('marquise/p0: 2w+keep+sawmill+wood x8')
  })
})
