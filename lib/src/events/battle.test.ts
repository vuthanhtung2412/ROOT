import { describe, expect, it, beforeEach } from 'vitest'
import type { ResolveEventAction } from '#actions/types.js'
import { warriors } from '#queries/pieces.js'
import { resetPlaceIds } from '#rules/place.js'
import {
  card,
  eyrieBoard,
  minimalState,
  player,
  testContext,
  type DieFace,
  withPieces,
} from '#test/fixtures.js'
import { isBattleEvent, isSeat } from '#typeGuards.js'
import type { BattleEvent, Event } from '#events/types.js'
import { applyDefenseless, battleResolver, isValidRemoval, openBattle } from '#events/battle.js'
import type { Ctx } from '#game/ctx.js'
import type { GameSignal } from '#triggers/signals.js'
import type { Seat } from '#pieces/types.js'

function battleContext(options?: {
  dice?: DieFace[]
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

function requireBattleEvent(event: Event | undefined): BattleEvent {
  if (!event || !isBattleEvent(event)) {
    throw new Error('expected pending battle event')
  }
  return event
}

interface BattleApplyInput {
  state: ReturnType<typeof minimalState>
  event: BattleEvent
  action: ResolveEventAction
  actor: Seat
  context: Ctx
}

function apply(
  input: BattleApplyInput,
): ReturnType<typeof battleResolver.apply> {
  const { state, event, action, actor, context } = input
  state.pending = [event]
  return battleResolver.apply(state, { event, action, actor }, context)
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
    apply({ state, event, action: { type: 'resolveEvent', cardId: 'ROOT-202#2' }, actor: 1, context })
    event = requireBattleEvent(state.pending[0])
    expect(event.stage).toBe('foil')
    apply({ state, event, action: { type: 'resolveEvent', decline: true }, actor: 0, context })
    event = requireBattleEvent(state.pending[0])
    expect(event.stage).toBe('removeAttacker')
    apply({ state, event, action: { type: 'resolveEvent', pieceIds: ['a1'] }, actor: 0, context })
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
    // faces [2, 3] → sorted high/low [3, 2]; attacker capped to 1 warrior
    const context = battleContext({ dice: [2, 3] })
    let event = battleEvent({ clearing: 5 })
    state.pending = [event]
    apply({ state, event, action: { type: 'resolveEvent', decline: true }, actor: 1, context })
    event = requireBattleEvent(state.pending[0])
    expect(event.rolls).toEqual([3, 2])
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
    const context = battleContext({ dice: [3, 3] })
    let event = battleEvent({ clearing: 0 })
    state.pending = [event]
    apply({ state, event, action: { type: 'resolveEvent', decline: true }, actor: 1, context })
    event = requireBattleEvent(state.pending[0])
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
    // raw [1, 3] → attacker high 3, defender low 1
    const context = battleContext({ dice: [1, 3] })
    let event = battleEvent({ clearing: 0 })
    state.pending = [event]
    apply({ state, event, action: { type: 'resolveEvent', decline: true }, actor: 1, context })
    event = requireBattleEvent(state.pending[0])
    expect(event.rolls).toEqual([3, 1])
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

  it('Rule: 7.8.3 Commander — attacker deals +1 hit', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'eyrie', { board: eyrieBoard({ leader: 'commander' }) }),
          player(1, 'marquise'),
        ],
      }),
      0,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'a2', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
        { id: 'd2', kind: 'warrior', owner: 1 },
      ],
    )
    // dice [0, 0] → base hits 0; Commander adds 1
    const context = battleContext({ dice: [0, 0] })
    let event = battleEvent({ clearing: 0, attacker: 0, defender: 1 })
    state.pending = [event]
    apply({ state, event, action: { type: 'resolveEvent', decline: true }, actor: 1, context })
    event = requireBattleEvent(state.pending[0])
    expect(event.hits.attacker).toBe(1)
    expect(event.hits.defender).toBe(0)
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
      {
        event,
        action: { type: 'resolveEvent', order: [1, 0] satisfies Seat[] },
        actor: 0,
      },
      context,
    )
    expect((requireBattleEvent(state.pending[0])).effectsOrder).toEqual([1, 0])
  })

  it('Rule: Battle 4 — victim removes warriors before buildings', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'w1', kind: 'warrior', owner: 1 },
      { id: 'b1', kind: 'building', owner: 1, type: 'sawmill' },
    ])
    expect(isValidRemoval(state, { clearing: 4, victim: 1, pieceIds: ['b1'], maxHits: 1 })).toBe(false)
    expect(isValidRemoval(state, { clearing: 4, victim: 1, pieceIds: ['w1'], maxHits: 1 })).toBe(true)
  })

  it('Rule: 1.4 + Battle 4.3.4 — exact hit count required', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'w1', kind: 'warrior', owner: 1 },
      { id: 'w2', kind: 'warrior', owner: 1 },
      { id: 'w3', kind: 'warrior', owner: 1 },
      { id: 'b1', kind: 'building', owner: 1, type: 'sawmill' },
    ])
    // Under-remove rejected when enough pieces remain
    expect(
      isValidRemoval(state, {
        clearing: 4,
        victim: 1,
        pieceIds: ['w1'],
        maxHits: 2,
      }),
    ).toBe(false)
    expect(
      isValidRemoval(state, {
        clearing: 4,
        victim: 1,
        pieceIds: ['w1', 'w2'],
        maxHits: 2,
      }),
    ).toBe(true)
    // Overflow: all warriors then building
    expect(
      isValidRemoval(state, {
        clearing: 4,
        victim: 1,
        pieceIds: ['w1', 'w2', 'w3', 'b1'],
        maxHits: 4,
      }),
    ).toBe(true)
    expect(
      isValidRemoval(state, {
        clearing: 4,
        victim: 1,
        pieceIds: ['w1', 'w2', 'b1'],
        maxHits: 4,
      }),
    ).toBe(false)
  })

  it('legalActions emit only exact-size warrior-first combos', () => {
    const state = withPieces(
      minimalState({
        players: [player(0, 'marquise'), player(1, 'marquise', { playerId: 'p1' })],
        status: 'playing',
      }),
      0,
      [
        { id: 'd1', kind: 'warrior', owner: 1 },
        { id: 'd2', kind: 'warrior', owner: 1 },
        { id: 'b1', kind: 'building', owner: 1, type: 'sawmill' },
      ],
    )
    const context = battleContext()
    const event = battleEvent({
      stage: 'removeDefender',
      hits: { attacker: 2, defender: 0 },
    })
    state.pending = [event]
    const actionSpecs = battleResolver.legalActions(state, event, context)
    const pieceIdLists = actionSpecs.map((spec) => {
      const params = spec.params
      if (params === undefined || typeof params !== 'object') {
        return []
      }
      const pieceIds = Reflect.get(params, 'pieceIds')
      return Array.isArray(pieceIds) ? pieceIds : []
    })
    expect(pieceIdLists.every((ids) => ids.length === 2)).toBe(true)
    expect(pieceIdLists).toEqual(
      expect.arrayContaining([
        ['d1', 'd2'],
      ]),
    )
    expect(pieceIdLists.some((ids) => ids.includes('b1'))).toBe(false)
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
    const context = battleContext({
      dice: [3, 1],
      onSignal: (signal) => signals.push(signal),
    })
    openBattle(state, { clearing: 4, attacker: 0, defender: 1 }, context)
    expect(signals.some((signal) => signal.s === 'battle.start')).toBe(true)

    let event = requireBattleEvent(state.pending[0])
    apply({ state, event, action: { type: 'resolveEvent', decline: true }, actor: 1, context })
    while (state.pending[0]?.type === 'battle') {
      event = requireBattleEvent(state.pending[0])
      if (event.stage === 'effects') {
        const seat = event.effectsOrder?.find((effectSeat) => {
          const side = effectSeat === event.attacker ? 'attacker' : 'defender'
          return !(event.effectsUsed && side in event.effectsUsed)
        })
        if (seat === undefined || !isSeat(seat)) break
        apply({ state, event, action: { type: 'resolveEvent', useEffect: false }, actor: seat, context })
      } else if (event.stage === 'removeDefender') {
        apply({ state, event, action: { type: 'resolveEvent', pieceIds: ['d1'] }, actor: 1, context })
      } else if (event.stage === 'removeAttacker') {
        apply({ state, event, action: { type: 'resolveEvent', pieceIds: ['a1'] }, actor: 0, context })
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
