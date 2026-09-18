import { describe, expect, it, beforeEach } from 'vitest'
import type { ResolveEventAction } from '../actions/types.js'
import { warriors } from '../queries/pieces.js'
import { resetPlaceIds } from '../rules/place.js'
import { card, minimalState, player, testCtx, withPieces } from '../test/fixtures.js'
import type { BattleEvent } from './types.js'
import { applyDefenseless, battleResolver, isValidRemoval, openBattle } from './battle.js'
import type { Ctx } from '../game/ctx.js'
import type { GameSignal } from '../triggers/signals.js'
import type { TestDie } from '../test/fixtures.js'

function battleCtx(opts?: { die?: TestDie; onSignal?: (s: GameSignal) => void }): Ctx {
  return testCtx(opts)
}

function battleEv(overrides?: Partial<BattleEvent>): BattleEvent {
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
  ev: BattleEvent,
  action: ResolveEventAction,
  actor: 0 | 1,
  ctx: Ctx,
) {
  state.pending = [ev]
  return battleResolver.apply(state, ev, action, actor, ctx)
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
    const ev = battleEv({ clearing: 0 })
    const ctx = battleCtx()
    const legal = battleResolver.legalActions(state, ev, ctx)
    expect(legal.some((s) => s.params?.cardIds?.includes('ROOT-202#2'))).toBe(true)
    expect(legal.some((s) => s.params?.cardIds?.includes('ROOT-200#1'))).toBe(true) // bird wild on fox clearing
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
    const ctx = battleCtx()
    const signals: GameSignal[] = []
    ctx.emit = (s) => signals.push(s)

    let ev = battleEv({ clearing: 0 })
    state.pending = [ev]
    apply(state, ev, { type: 'resolveEvent', cardId: 'ROOT-202#2' }, 1, ctx)
    ev = state.pending[0] as BattleEvent
    expect(ev.stage).toBe('foil')
    apply(state, ev, { type: 'resolveEvent', decline: true }, 0, ctx)
    ev = state.pending[0] as BattleEvent
    expect(ev.stage).toBe('removeAttacker')
    apply(state, ev, { type: 'resolveEvent', pieceIds: ['a1'] }, 0, ctx)
    expect(state.pending).toHaveLength(0)
    expect(signals.some((s) => s.s === 'battle.end')).toBe(true)
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
    const ctx = battleCtx({ die: { mode: 'seeded', seed: 99 } })
    let ev = battleEv({ clearing: 5 })
    state.pending = [ev]
    apply(state, ev, { type: 'resolveEvent', decline: true }, 1, ctx)
    ev = state.pending[0] as BattleEvent
    expect(ev.rolls).toBeDefined()
    expect(ev.hits.attacker).toBeLessThanOrEqual(1)
    expect(ev.hits.defender).toBeLessThanOrEqual(3)
  })

  it('Rule: Battle 3 — defenseless +1 attacker hit', () => {
    const state = withPieces(
      minimalState(),
      0,
      [{ id: 'a1', kind: 'warrior', owner: 0 }],
    )
    const ev = battleEv({ hits: { attacker: 0, defender: 0 } })
    applyDefenseless(state, ev)
    expect(ev.hits.attacker).toBe(1)
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
    const ev = battleEv({
      clearing: 0,
      stage: 'effectsOrder',
      rolls: [3, 1],
      hits: { attacker: 1, defender: 1 },
    })
    const ctx = battleCtx()
    state.pending = [ev]
    battleResolver.apply(
      state,
      ev,
      { type: 'resolveEvent', order: [1, 0] as (0 | 1)[] },
      0,
      ctx,
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
    const ctx = battleCtx({ onSignal: (s) => signals.push(s) })
    openBattle(state, 4, 0, 1, ctx)
    expect(signals.some((s) => s.s === 'battle.start')).toBe(true)

    let ev = state.pending[0] as BattleEvent
    apply(state, ev, { type: 'resolveEvent', decline: true }, 1, ctx)
    while (state.pending[0]?.type === 'battle') {
      ev = state.pending[0] as BattleEvent
      if (ev.stage === 'effects') {
        const seat = ev.effectsOrder?.find((s) => {
          const side = s === ev.attacker ? 'attacker' : 'defender'
          return !(ev.effectsUsed && side in ev.effectsUsed)
        })
        if (seat === undefined) break
        apply(state, ev, { type: 'resolveEvent', useEffect: false }, seat as 0 | 1, ctx)
      } else if (ev.stage === 'removeDefender') {
        apply(state, ev, { type: 'resolveEvent', pieceIds: ['d1'] }, 1, ctx)
      } else if (ev.stage === 'removeAttacker') {
        apply(state, ev, { type: 'resolveEvent', pieceIds: ['a1'] }, 0, ctx)
      } else break
    }
    expect(signals.some((s) => s.s === 'battle.hits')).toBe(true)
    expect(signals.some((s) => s.s === 'battle.end')).toBe(true)
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
    const ctx = battleCtx()
    const ev = battleEv({
      stage: 'removeDefender',
      hits: { attacker: 1, defender: 0 },
    })
    state.pending = [ev]
    const specs = battleResolver.legalActions(state, ev, ctx)
    expect(specs.length).toBeGreaterThan(0)
    const action = { type: 'resolveEvent' as const, pieceIds: ['d1'] }
    expect(battleResolver.matchesAction(state, ev, action, ctx)).toBe(true)
  })
})
