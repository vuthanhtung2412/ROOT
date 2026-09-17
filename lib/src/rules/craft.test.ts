import { describe, expect, it } from 'vitest'
import { defOf } from '../cards/Deck.js'
import type { GameSignal } from '../triggers/signals.js'
import { FALL } from '../map/fall.js'
import { defaultRuleHooks } from '../triggers/hooks.js'
import { card, minimalState, player, withPieces } from '../test/fixtures.js'
import { craftCard } from './craft.js'

function ctx(onSignal?: (s: GameSignal) => void) {
  const hooks = defaultRuleHooks(FALL)
  return {
    map: FALL,
    rng: { roll: () => 1, toJSON: () => ({ seed: 1, cursor: 0 }) },
    emit: (s: GameSignal) => onSignal?.(s),
    hooks,
    grantedActions: () => [],
  }
}

describe('craftCard', () => {
  it('Rule: Victory — craft item scores printed VP via hooks.craftVp before signal', () => {
    const hammer = card('ROOT-204')
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise', { hand: [hammer], vp: 0 }),
          player(1, 'marquise'),
        ],
      }),
      0,
      [
        {
          id: 'ws',
          kind: 'building',
          owner: 0,
          type: 'workshop',
          used: false,
        },
      ],
    )
    const signals: GameSignal[] = []
    craftCard(state, 0, hammer.id, ctx((s) => signals.push(s)))
    expect(state.players[0]!.vp).toBe(defOf(hammer).vp)
    expect(state.players[0]!.craftedItems).toContain('hammer')
    expect(signals.some((s) => s.s === 'craft.item')).toBe(true)
    const vpIdx = signals.findIndex((s) => s.s === 'vp')
    const craftIdx = signals.findIndex((s) => s.s === 'craft.item')
    expect(vpIdx).toBeGreaterThanOrEqual(0)
    expect(craftIdx).toBeGreaterThan(vpIdx)
  })

  it('Rule: Craft — persistent goes to playArea and emits craft.persistent', () => {
    const persistent = card('ROOT-57')
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise', { hand: [persistent] }),
          player(1, 'marquise'),
        ],
      }),
      0,
      [
        { id: 'ws', kind: 'building', owner: 0, type: 'workshop', used: false },
        { id: 'ws2', kind: 'building', owner: 0, type: 'workshop', used: false },
      ],
    )
    const signals: GameSignal[] = []
    craftCard(state, 0, persistent.id, ctx((s) => signals.push(s)))
    expect(state.players[0]!.playArea.some((c) => c.defId === 'ROOT-57')).toBe(true)
    expect(signals.some((s) => s.s === 'craft.persistent')).toBe(true)
  })
})
