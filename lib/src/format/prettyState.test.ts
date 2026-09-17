import { describe, expect, it } from 'vitest'
import {
  cardLabel,
  describeLogEntry,
  formatGameView,
  formatPieceChunk,
  formatTurnLog,
} from './prettyState.js'
import { minimalState, player, withPieces } from '../test/fixtures.js'
import type { LogEntry } from '../log/types.js'

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

describe('describeLogEntry / formatTurnLog', () => {
  it('formats each entry as one readable line', () => {
    const state = minimalState({
      players: [
        player(0, 'marquise', {
          hand: [{ id: 'ROOT-03#1', defId: 'ROOT-03' }],
        }),
        player(1, 'marquise'),
      ],
    })
    const log: LogEntry[] = [
      { t: 'join', playerId: 'alice', faction: 'marquise' },
      { t: 'start' },
      { t: 'action', actor: 0, action: { type: 'craft', cardId: 'ROOT-03#1' } },
      { t: 'vp', actor: 0, delta: 1, reason: 'craft' },
      {
        t: 'pieces',
        clearing: 0,
        placed: [{ id: 'w1', kind: 'warrior', owner: 0 }],
        removed: [{ id: 'wood-1', kind: 'token', type: 'wood', owner: 0 }],
      },
      { t: 'phase', actor: 0, phase: 'daylight', step: 'actions' },
      {
        t: 'event',
        event: {
          type: 'battle',
          clearing: 4,
          attacker: 0,
          defender: 1,
          stage: 'roll',
          rolls: [2, 1],
          hits: { attacker: 1, defender: 2 },
        },
      },
      { t: 'win', winner: 0 },
    ]

    expect(describeLogEntry(log[0]!, state)).toBe('JOIN alice (marquise)')
    expect(describeLogEntry(log[2]!, state)).toMatch(/^s0 CRAFT /)
    expect(describeLogEntry(log[3]!, state)).toBe('s0 +1vp (craft)')
    expect(describeLogEntry(log[4]!, state)).toBe('pieces C0 +s0:1w -s0:wood')
    expect(describeLogEntry(log[5]!, state)).toBe('s0 → daylight/actions')
    expect(describeLogEntry(log[6]!, state)).toContain('BATTLE C4')
    expect(formatTurnLog(log, state).split('\n')).toHaveLength(8)
  })

  it('empty log', () => {
    expect(formatTurnLog([], minimalState())).toBe('(empty log)')
  })
})
