import { describe, expect, it } from 'vitest'
import { defOf } from '../cards/Deck.js'
import type { GameSignal } from '../triggers/signals.js'
import {
  card,
  eyrieBoard,
  minimalState,
  player,
  testContext,
  withPieces,
} from '../test/fixtures.js'
import { craftCard } from './craft.js'

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
    craftCard(
      state,
      0,
      hammer.id,
      testContext({ onSignal: (signal) => signals.push(signal) }),
    )
    expect(state.players[0]!.vp).toBe(defOf(hammer).vp)
    expect(state.players[0]!.craftedItems.map((item) => item.type)).toContain('hammer')
    expect(signals.some((signal) => signal.s === 'craft.item')).toBe(true)
    const vpIndex = signals.findIndex((signal) => signal.s === 'vp')
    const craftIndex = signals.findIndex((signal) => signal.s === 'craft.item')
    expect(vpIndex).toBeGreaterThanOrEqual(0)
    expect(craftIndex).toBeGreaterThan(vpIndex)
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
    craftCard(
      state,
      0,
      persistent.id,
      testContext({ onSignal: (signal) => signals.push(signal) }),
    )
    expect(state.players[0]!.playArea.some((playCard) => playCard.defId === 'ROOT-57')).toBe(
      true,
    )
    expect(signals.some((signal) => signal.s === 'craft.persistent')).toBe(true)
  })

  it('rejects ambush before mutating hand or workshops', () => {
    const ambush = card('ROOT-201')
    const workshop = {
      id: 'ws',
      kind: 'building' as const,
      owner: 0 as const,
      type: 'workshop' as const,
      used: false,
    }
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise', { hand: [ambush], vp: 0 }),
          player(1, 'marquise'),
        ],
      }),
      0,
      [workshop],
    )
    expect(() => craftCard(state, 0, ambush.id, testContext())).toThrow(
      /NOT_CRAFTABLE|CANNOT_CRAFT/,
    )
    expect(state.players[0]!.hand.map((handCard) => handCard.id)).toEqual([ambush.id])
    expect(state.players[0]!.vp).toBe(0)
    expect(workshop.used).toBe(false)
  })

  it('Rule: 7.2.3 Disdain — non-Builder Eyrie item craft scores 1', () => {
    const hammer = card('ROOT-204')
    const state = withPieces(
      minimalState({
        factions: ['eyrie', 'marquise'],
        players: [
          player(0, 'eyrie', {
            hand: [hammer],
            vp: 0,
            board: eyrieBoard({ leader: 'charismatic' }),
          }),
          player(1, 'marquise'),
        ],
        currentSeat: 0,
      }),
      0,
      [{ id: 'r', kind: 'building', owner: 0, type: 'roost', used: false }],
    )
    craftCard(state, 0, hammer.id, testContext({ state }))
    expect(state.players[0]!.vp).toBe(1)
  })

  it('Rule: 7.8.1 Builder ignores Disdain — printed item VP', () => {
    const hammer = card('ROOT-204')
    const state = withPieces(
      minimalState({
        factions: ['eyrie', 'marquise'],
        players: [
          player(0, 'eyrie', {
            hand: [hammer],
            vp: 0,
            board: eyrieBoard({ leader: 'builder' }),
          }),
          player(1, 'marquise'),
        ],
        currentSeat: 0,
      }),
      0,
      [{ id: 'r', kind: 'building', owner: 0, type: 'roost', used: false }],
    )
    craftCard(state, 0, hammer.id, testContext({ state }))
    expect(state.players[0]!.vp).toBe(defOf(hammer).vp)
  })
})
