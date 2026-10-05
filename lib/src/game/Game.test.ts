import { describe, expect, it } from 'vitest'
import { defOf } from '#cards/Deck.js'
import type { ActionSpec } from '#actions/types.js'
import { FALL } from '#map/fall.js'
import { warriors } from '#queries/pieces.js'
import { keepCornerFor } from '#factions/Marquise.js'
import { placeReturning } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import { SeededRng } from '#rules/Rng.js'
import {
  card,
  createLobbyGame as lobbyTwo,
  createPlayingGame,
  finishSetup,
} from '#test/fixtures.js'
import { DEFAULT_FACTIONS, HAND_LIMIT, STARTING_HAND } from '#state/constants.js'
import type { GameSignal } from '#triggers/signals.js'
import { EFFECTS } from '#triggers/effects.js'
import { Game } from '#game/Game.js'

function startPlaying(seed = 42): Game {
  return createPlayingGame({ seed })
}

describe('Game lobby', () => {
  it('Game.create → waiting status', () => {
    const game = Game.create({ seed: 1 })
    expect(game.state.status).toBe('waiting')
    expect(game.state.factions).toEqual(DEFAULT_FACTIONS)
    expect(game.state.players).toHaveLength(0)
  })

  it('Game.create rejects factions without implementations', () => {
    expect(() =>
      // @ts-expect-error -- 'lizard' is deliberately not a supported faction
      Game.create({ seed: 1, factions: ['marquise', 'lizard'] }),
    ).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_FACTION' }))
  })

  it('Game.join assigns factions[seat] — marquise, eyrie, alliance, vagabond', () => {
    const game = Game.create({ seed: 1 })
    game.join('p0')
    game.join('p1')
    game.join('p2')
    game.join('p3')
    expect(game.state.players[0]!.faction).toBe('marquise')
    expect(game.state.players[1]!.faction).toBe('eyrie')
    expect(game.state.players[2]!.faction).toBe('alliance')
    expect(game.state.players[3]!.faction).toBe('vagabond')
  })

  it('Game.join rejects when full', () => {
    const game = Game.create({ seed: 1, factions: ['marquise', 'eyrie'] })
    game.join('a')
    game.join('b')
    expect(() => game.join('c')).toThrow(RuleError)
    expect(() => game.join('c')).toThrow(expect.objectContaining({ code: 'LOBBY_FULL' }))
  })

  it('Game.join does not auto-start — 2 joined still waiting', () => {
    const game = lobbyTwo()
    expect(game.state.status).toBe('waiting')
  })
})

describe('Game.start', () => {
  it('Game.start requires players greater than 1', () => {
    const game = Game.create({ seed: 1 })
    expect(() => game.start()).toThrow(expect.objectContaining({ code: 'NOT_ENOUGH_PLAYERS' }))
    game.join('solo')
    expect(() => game.start()).toThrow(expect.objectContaining({ code: 'NOT_ENOUGH_PLAYERS' }))
  })

  it('Rule: Setup 3 — 2p strips dominance from deck', () => {
    const game = startPlaying(99)
    const allCards = [...game.state.deck.draw, ...game.state.deck.discard]
    for (const player of game.state.players) {
      allCards.push(...player.hand)
    }
    expect(allCards.some((c) => defOf(c).type === 'dominance')).toBe(false)
    expect(game.state.dominanceAvailable).toHaveLength(0)
  })

  it('Rule: Setup 2–5 — deals hands, ruins, item supply', () => {
    const game = startPlaying(7)
    for (const player of game.state.players) {
      expect(player.hand).toHaveLength(STARTING_HAND)
    }
    expect(game.state.itemSupply.boot).toBe(2)
    const ruins = game.state.clearings.filter((c) => c.ruin !== undefined)
    expect(ruins).toHaveLength(4)
  })

  it('Game.start → setup chooseKeep; resolve → playing + faction pieces', () => {
    const game = lobbyTwo(5)
    game.start()
    expect(game.state.status).toBe('setup')
    expect(game.state.pending[0]?.type).toBe('chooseKeep')
    finishSetup(game)
    expect(game.state.status).toBe('playing')
    expect(keepCornerFor(game.state, 0)).toBe(FALL.corners[0])
    expect(warriors(game.state, FALL.corners[0]!, 0)).toBe(1)
    const eyrieStart = FALL.opposite(FALL.corners[0])!
    expect(warriors(game.state, eyrieStart, 1)).toBe(6)
    expect(
      game.state.clearings[eyrieStart]!.pieces.some(
        (p) => p.kind === 'building' && p.type === 'roost' && p.owner === 1,
      ),
    ).toBe(true)
  })
})

describe('Game.legalActions', () => {
  it('waiting → join (+ start if ≥2 players)', () => {
    const game = Game.create({ seed: 1 })
    expect(game.legalActions().map((a) => a.type)).toEqual(['join'])
    game.join('a')
    expect(game.legalActions().map((a) => a.type)).toEqual(['join'])
    game.join('b')
    expect(game.legalActions().map((a) => a.type)).toEqual(['join', 'start'])
  })
})

describe('Game.apply', () => {
  it('endPhase advances steps and phases', () => {
    const game = startPlaying(3)
    expect(game.state.phase).toBe('birdsong')
    expect(game.state.step).toBe('wood')

    game.apply({ type: 'endPhase' })
    expect(game.state.phase).toBe('daylight')
    expect(game.state.step).toBe('craft')

    game.apply({ type: 'endPhase' })
    expect(game.state.step).toBe('actions')
  })

  it('Game.apply runs autoActions — empty for Phase 5 skeleton', () => {
    const game = startPlaying(3)
    const len = game.history.length
    game.apply({ type: 'endPhase' })
    expect(game.history.length).toBe(len + 1)
  })

  it('Game.apply gates on pending queue head — FIFO', () => {
    const game = startPlaying(3)
    game.state.pending.push({
      type: 'fieldHospital',
      victim: 0,
      clearing: 0,
      count: 1,
    })
    expect(game.legalActions().every((a) => a.type === 'resolveEvent')).toBe(true)
    expect(() => game.apply({ type: 'endPhase' })).toThrow(
      expect.objectContaining({ code: 'PENDING_EVENT' }),
    )
  })

  it('Game emits phase.start/end signals', () => {
    const game = startPlaying(3)
    const signals: GameSignal[] = []
    const unsub = game.subscribeSignals((_, signal) => {
      signals.push(signal)
    })
    game.apply({ type: 'endPhase' })
    unsub()
    expect(signals.some((s) => s.s === 'phase.end' && s.phase === 'birdsong')).toBe(true)
    expect(signals.some((s) => s.s === 'phase.start' && s.phase === 'daylight')).toBe(true)
  })

  it('Game merges granted actions into legalActions', () => {
    const game = startPlaying(3)
    const granted: ActionSpec = { type: 'swapMeet', actor: 0 }
    EFFECTS['test-grant'] = {
      defId: 'test-grant',
      grants: () => [granted],
    }
    game.state.players[0]!.playArea.push({ id: 'test-grant#1', defId: 'test-grant' })
    expect(game.legalActions()).toEqual(
      expect.arrayContaining([{ type: 'endPhase', actor: 0 }, granted]),
    )
    delete EFFECTS['test-grant']
  })

  it('Rule: Victory — 30 VP seat winner; tie-break currentSeat', () => {
    const game = startPlaying(3)
    game.state.players[0]!.vp = 30
    game.state.players[1]!.vp = 30
    game.apply({ type: 'endPhase' })
    expect(game.state.winner).toBe(0)
    expect(game.state.status).toBe('finished')
  })
})

describe('evening discard validation', () => {
  it('rejects partial discard (DISCARD_TOO_FEW)', () => {
    const game = startPlaying(1)
    const s = game.state
    s.phase = 'evening'
    s.step = 'discard'
    s.currentSeat = 0
    s.players[0]!.hand = Array.from({ length: 7 }, (_, i) => card('ROOT-72', i))
    expect(() =>
      game.apply({ type: 'discard', cardIds: ['ROOT-72#0'] }),
    ).toThrow(expect.objectContaining({ code: 'DISCARD_TOO_FEW' }))
  })

  it('Rule: Evening — discard until you have five: rejects discarding below five (DISCARD_TOO_MANY)', () => {
    const game = startPlaying(1)
    const s = game.state
    s.phase = 'evening'
    s.step = 'discard'
    s.currentSeat = 0
    s.players[0]!.hand = Array.from({ length: 7 }, (_, i) => card('ROOT-72', i))
    expect(() =>
      game.apply({
        type: 'discard',
        cardIds: ['ROOT-72#0', 'ROOT-72#1', 'ROOT-72#2'],
      }),
    ).toThrow(expect.objectContaining({ code: 'DISCARD_TOO_MANY' }))
    expect(s.players[0]!.hand).toHaveLength(7)
  })

  it('Rule: Evening — discard until you have five: accepts the exact count', () => {
    const game = startPlaying(1)
    const s = game.state
    s.phase = 'evening'
    s.step = 'discard'
    s.currentSeat = 0
    s.players[0]!.hand = Array.from({ length: 7 }, (_, i) => card('ROOT-72', i))
    game.apply({ type: 'discard', cardIds: ['ROOT-72#0', 'ROOT-72#1'] })
    expect(s.players[0]!.hand).toHaveLength(5)
  })

  it('omits endPhase from legal actions until hand at limit', () => {
    const game = startPlaying(1)
    const s = game.state
    s.phase = 'evening'
    s.step = 'discard'
    s.currentSeat = 0
    s.players[0]!.hand = Array.from({ length: 7 }, (_, i) => card('ROOT-72', i))
    const types = game.legalActions().map((a) => a.type)
    expect(types).toContain('discard')
    expect(types).not.toContain('endPhase')
  })

  it('rejects endPhase at discard while hand over limit', () => {
    const game = startPlaying(1)
    const s = game.state
    s.phase = 'evening'
    s.step = 'discard'
    s.currentSeat = 0
    s.players[0]!.hand = Array.from({ length: 7 }, (_, i) => card('ROOT-72', i))
    expect(() => game.apply({ type: 'endPhase' })).toThrow(
      expect.objectContaining({ code: 'ILLEGAL_ACTION' }),
    )
  })

  it('accepts discard down to hand limit', () => {
    const game = startPlaying(99)
    const s = game.state
    s.phase = 'evening'
    s.step = 'discard'
    s.currentSeat = 0
    s.players[0]!.hand = Array.from({ length: 7 }, (_, i) => card('ROOT-72', i))
    expect(game.legalActions().some((a) => a.type === 'discard')).toBe(true)
    game.apply({
      type: 'discard',
      cardIds: ['ROOT-72#0', 'ROOT-72#1'],
    })
    expect(s.players[0]!.hand).toHaveLength(HAND_LIMIT)
  })
})

describe('Game replay and undo', () => {
  it('replay reproduces state', () => {
    const game = startPlaying(11)
    game.apply({ type: 'endPhase' })
    game.apply({ type: 'endPhase' })
    const replayed = Game.replay(11, [...game.history])
    expect(replayed.state).toEqual(game.state)
    expect(replayed.log).toEqual(game.log)
  })

  it('undo rewinds one action', () => {
    const game = startPlaying(11)
    const before = structuredClone(game.state)
    game.apply({ type: 'endPhase' })
    game.undo()
    expect(game.state).toEqual(before)
    expect(game.history).toHaveLength(8) // join×2 start keep sawmill workshop recruiter leader
  })
})

describe('Game snapshot', () => {
  it('toJSON/fromJSON round-trip — state + rng cursor', () => {
    const game = startPlaying(123)
    game.apply({ type: 'endPhase' })
    const rngBefore = game.toJSON().rng
    const nextRoll = SeededRng.fromJSON(rngBefore).roll()

    const snap = game.toJSON()
    const restored = Game.fromJSON(snap)
    expect(restored.state).toEqual(snap.state)
    expect(restored.history).toEqual(snap.history)
    expect(restored.log).toEqual(snap.log)
    expect(restored.toJSON().rng).toEqual(snap.rng)
    expect(SeededRng.fromJSON(restored.toJSON().rng).roll()).toBe(nextRoll)
  })

  it('fromJSON runs pending autoActions — Rule: 7.6.1 evening score on load', () => {
    const game = startPlaying(7)
    const snap = game.toJSON()
    // Land on Eyrie evening score with 3 roosts, score not yet applied
    snap.state.currentSeat = 1
    snap.state.phase = 'evening'
    snap.state.step = 'score'
    snap.state.turnScratch.eveningScoreDone = false
    snap.state.players[1]!.vp = 0
    // clearings already have 1 roost at setup; add 2 more
    let added = 0
    for (let i = 0; i < 12 && added < 2; i++) {
      const has = snap.state.clearings[i]!.pieces.some(
        (p) => p.kind === 'building' && p.type === 'roost' && p.owner === 1,
      )
      if (has) continue
      snap.state.clearings[i]!.pieces.push({
        id: `r-extra-${i}`,
        kind: 'building',
        type: 'roost',
        owner: 1,
        used: false,
      })
      added++
    }
    const restored = Game.fromJSON(snap)
    expect(restored.state.turnScratch.eveningScoreDone).toBe(true)
    expect(restored.state.players[1]!.vp).toBe(2)
  })

  it('fromJSON syncs place ids — no duplicate w-N after placeReturning', () => {
    const game = startPlaying(17)
    const snap = game.toJSON()
    const keep = snap.state.clearings.findIndex((clearing) =>
      clearing.pieces.some(
        (piece) => piece.kind === 'token' && piece.type === 'keep',
      ),
    )
    expect(keep).toBeGreaterThanOrEqual(0)
    snap.state.clearings[keep]!.pieces.push({
      id: 'w-99',
      kind: 'warrior',
      owner: 0,
    })
    const restored = Game.fromJSON(snap)
    placeReturning(restored.state, {
      seat: 0,
      clearing: keep,
      spec: { kind: 'warrior' },
      count: 1,
    })
    const warriorIds = restored.state.clearings[keep]!.pieces
      .filter((piece) => piece.kind === 'warrior' && piece.owner === 0)
      .map((piece) => piece.id)
    expect(warriorIds).toContain('w-99')
    expect(warriorIds).toContain('w-100')
    expect(new Set(warriorIds).size).toBe(warriorIds.length)
  })
})
