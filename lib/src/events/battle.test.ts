import { describe, expect, it, beforeEach } from 'vitest'
import type { ResolveEventAction } from '../actions/types.js'
import { warriors } from '../queries/pieces.js'
import { resetPlaceIds } from '../rules/place.js'
import {
  card,
  minimalState,
  player,
  testContext,
  type TestDice,
  withPieces,
} from '../test/fixtures.js'
import type { BattleEvent } from './types.js'
import { applyDefenseless, battleResolver, isValidRemoval, openBattle } from './battle.js'
import type { Ctx } from '../game/ctx.js'
import type { GameSignal } from '../triggers/signals.js'

function battleContext(options?: {
  dice?: TestDice
  onSignal?: (signal: GameSignal) => void
}): Ctx {
  return testContext(options)
}

function battleEvent(overrides?: Partial<BattleEvent>): BattleEvent {
  return {
    type: 'battle',
    clearing: 0,
    attacker: 0,
    defender: 1,
    stage: 'ambush',
    hits: { attacker: 0, defender: 0 },
    ...overrides,
  }
}

function apply(
  state: ReturnType<typeof minimalState>,
  event: BattleEvent,
  action: ResolveEventAction,
  actor: 0 | 1,
  context: Ctx,
) {
  state.pending = [event]
  return battleResolver.apply(state, event, action, actor, context)
}

describe('battleResolver', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Battle 1 — ambush suit = clearing; bird ok', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise'),
          player(1, 'marquise', { hand: [card('ROOT-202', 2), card('ROOT-200')] }),
        ],
      }),
      0,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
      ],
    )
    const event = battleEvent({ clearing: 0 })
    const context = battleContext()
    const legal = battleResolver.legalActions(state, event, context)
    expect(legal.some((spec) => spec.params?.cardIds?.includes('ROOT-202#2'))).toBe(true)
    expect(legal.some((spec) => spec.params?.cardIds?.includes('ROOT-200#1'))).toBe(true) // bird wild on fox clearing
  })

  it('Rule: Battle 1 — end if no attackers after ambush removal', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise'),
          player(1, 'marquise', { hand: [card('ROOT-202', 2)] }),
        ],
      }),
      0,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
      ],
    )
    const context = battleContext()
    const signals: GameSignal[] = []
    context.emit = (signal) => signals.push(signal)

    let event = battleEvent({ clearing: 0 })
    state.pending = [event]
    apply(state, event, { type: 'resolveEvent', cardId: 'ROOT-202#2' }, 1, context)
    event = state.pending[0] as BattleEvent
    expect(event.stage).toBe('foil')
    apply(state, event, { type: 'resolveEvent', decline: true }, 0, context)
    event = state.pending[0] as BattleEvent
    expect(event.stage).toBe('removeAttacker')
    apply(state, event, { type: 'resolveEvent', pieceIds: ['a1'] }, 0, context)
    expect(state.pending).toHaveLength(0)
    expect(signals.some((signal) => signal.s === 'battle.end')).toBe(true)
    expect(warriors(state, 0, 0)).toBe(0)
  })

  it('Rule: Battle 2 — max hits = warriors', () => {
    const state = withPieces(
      minimalState(),
      5,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
        { id: 'd2', kind: 'warrior', owner: 1 },
        { id: 'd3', kind: 'warrior', owner: 1 },
      ],
    )
    // faces [2, 5] → sorted high/low [5, 2]; attacker capped to 1 warrior
    const context = battleContext({ dice: { mode: 'fixed', faces: [2, 5] } })
    let event = battleEvent({ clearing: 5 })
    state.pending = [event]
    apply(state, event, { type: 'resolveEvent', decline: true }, 1, context)
    event = state.pending[0] as BattleEvent
    expect(event.rolls).toEqual([5, 2])
    expect(event.hits.attacker).toBe(1)
    expect(event.hits.defender).toBe(2)
  })

  it('Rule: Battle 2 — equal rolls deal equal hits', () => {
    const state = withPieces(
      minimalState(),
      0,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'a2', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
        { id: 'd2', kind: 'warrior', owner: 1 },
      ],
    )
    const context = battleContext({ dice: { mode: 'fixed', faces: [3, 3] } })
    let event = battleEvent({ clearing: 0 })
    state.pending = [event]
    apply(state, event, { type: 'resolveEvent', decline: true }, 1, context)
    event = state.pending[0] as BattleEvent
    expect(event.rolls).toEqual([3, 3])
    expect(event.hits.attacker).toBe(2)
    expect(event.hits.defender).toBe(2)
  })

  it('Rule: Battle 2 — attacker gets higher die', () => {
    const state = withPieces(
      minimalState(),
      0,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'a2', kind: 'warrior', owner: 0 },
        { id: 'a3', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
        { id: 'd2', kind: 'warrior', owner: 1 },
        { id: 'd3', kind: 'warrior', owner: 1 },
      ],
    )
    // raw [1, 4] → attacker high 4, defender low 1
    const context = battleContext({ dice: { mode: 'fixed', faces: [1, 4] } })
    let event = battleEvent({ clearing: 0 })
    state.pending = [event]
    apply(state, event, { type: 'resolveEvent', decline: true }, 1, context)
    event = state.pending[0] as BattleEvent
    expect(event.rolls).toEqual([4, 1])
    expect(event.hits.attacker).toBe(3)
    expect(event.hits.defender).toBe(1)
  })

  it('Rule: Battle 3 — defenseless +1 attacker hit', () => {
    const state = withPieces(
      minimalState(),
      0,
      [{ id: 'a1', kind: 'warrior', owner: 0 }],
    )
    const event = battleEvent({ hits: { attacker: 0, defender: 0 } })
    applyDefenseless(state, event)
    expect(event.hits.attacker).toBe(1)
  })

  it('Rule: Battle 3 — both have effects → attacker picks order', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise', { playArea: [card('ROOT-77')] }),
          player(1, 'marquise', { playArea: [card('ROOT-77', 2)] }),
        ],
      }),
      0,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
      ],
    )
    const event = battleEvent({
      clearing: 0,
      stage: 'effectsOrder',
      rolls: [3, 1],
      hits: { attacker: 1, defender: 1 },
    })
    const context = battleContext()
    state.pending = [event]
    battleResolver.apply(
      state,
      event,
      { type: 'resolveEvent', order: [1, 0] as (0 | 1)[] },
      0,
      context,
    )
    expect((state.pending[0] as BattleEvent).effectsOrder).toEqual([1, 0])
  })

  it('Rule: Battle 4 — victim removes warriors before buildings', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'w1', kind: 'warrior', owner: 1 },
      { id: 'b1', kind: 'building', owner: 1, type: 'sawmill', used: false },
    ])
    expect(isValidRemoval(state, 4, 1, ['b1'], 1)).toBe(false)
    expect(isValidRemoval(state, 4, 1, ['w1'], 1)).toBe(true)
  })

  it('battle emits battle.start/hits/end signals', () => {
    const state = withPieces(
      minimalState(),
      4,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
      ],
    )
    const signals: GameSignal[] = []
    const context = battleContext({ onSignal: (signal) => signals.push(signal) })
    openBattle(state, 4, 0, 1, context)
    expect(signals.some((signal) => signal.s === 'battle.start')).toBe(true)

    let event = state.pending[0] as BattleEvent
    apply(state, event, { type: 'resolveEvent', decline: true }, 1, context)
    while (state.pending[0]?.type === 'battle') {
      event = state.pending[0] as BattleEvent
      if (event.stage === 'effects') {
        const seat = event.effectsOrder?.find((effectSeat) => {
          const side = effectSeat === event.attacker ? 'attacker' : 'defender'
          return !(event.effectsUsed && side in event.effectsUsed)
        })
        if (seat === undefined) break
        apply(state, event, { type: 'resolveEvent', useEffect: false }, seat as 0 | 1, context)
      } else if (event.stage === 'removeDefender') {
        apply(state, event, { type: 'resolveEvent', pieceIds: ['d1'] }, 1, context)
      } else if (event.stage === 'removeAttacker') {
        apply(state, event, { type: 'resolveEvent', pieceIds: ['a1'] }, 0, context)
      } else break
    }
    expect(signals.some((signal) => signal.s === 'battle.hits')).toBe(true)
    expect(signals.some((signal) => signal.s === 'battle.end')).toBe(true)
  })

  it('matchesAction accepts flat pieceIds combo from legalRemovalSpecs', () => {
    const state = withPieces(
      minimalState({
        players: [player(0, 'marquise'), player(1, 'marquise', { playerId: 'p1' })],
        status: 'playing',
      }),
      0,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
      ],
    )
    const context = battleContext()
    const event = battleEvent({
      stage: 'removeDefender',
      hits: { attacker: 1, defender: 0 },
    })
    state.pending = [event]
    const actionSpecs = battleResolver.legalActions(state, event, context)
    expect(actionSpecs.length).toBeGreaterThan(0)
    const action = { type: 'resolveEvent' as const, pieceIds: ['d1'] }
    expect(battleResolver.matchesAction(state, event, action, context)).toBe(true)
  })
})
