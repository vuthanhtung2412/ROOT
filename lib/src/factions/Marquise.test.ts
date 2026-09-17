import { describe, expect, it, beforeEach } from 'vitest'
import { FALL } from '../map/fall.js'
import { warriors } from '../queries/pieces.js'
import { keepOwner } from '../queries/place.js'
import { resetPlaceIds } from '../rules/place.js'
import { defaultRuleHooks } from '../triggers/hooks.js'
import { player, minimalState } from '../test/fixtures.js'
import { keepCornerFor, MARQUISE } from './Marquise.js'

function setupCtx() {
  return {
    map: FALL,
    rng: { roll: () => 1, toJSON: () => ({ seed: 1, cursor: 0 }) },
    emit: () => {},
    hooks: defaultRuleHooks(FALL),
    grantedActions: () => [],
  }
}

describe('Marquise setup', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Marquise > Setup 1–2 — 1st cat keep at corners[0]', () => {
    const state = minimalState({
      status: 'playing',
      players: [player(0, 'marquise')],
    })
    MARQUISE.setup(state, 0, setupCtx())
    expect(keepOwner(state, FALL.corners[0])).toBe(0)
  })

  it('Rule: Marquise > Setup 1–2 — 2nd cat keep at opposite corner', () => {
    const state = minimalState({
      players: [player(0, 'marquise'), player(1, 'marquise')],
    })
    MARQUISE.setup(state, 1, setupCtx())
    expect(keepCornerFor(state, 1)).toBe(FALL.opposite(FALL.corners[0]))
    expect(keepOwner(state, FALL.opposite(FALL.corners[0]))).toBe(1)
  })

  it('Rule: Marquise > Setup 3 — single cat garrisons all except opposite corner', () => {
    const state = minimalState({
      players: [player(0, 'marquise')],
    })
    MARQUISE.setup(state, 0, setupCtx())
    const keep = FALL.corners[0]!
    const opposite = FALL.opposite(keep)

    for (let c = 0; c < 12; c++) {
      if (c === opposite) {
        expect(warriors(state, c, 0)).toBe(0)
      } else {
        expect(warriors(state, c, 0)).toBe(1)
      }
    }
  })

  it('House rule: 2-cat garrison — keep + adjacent only', () => {
    const state = minimalState({
      players: [player(0, 'marquise'), player(1, 'marquise')],
    })
    MARQUISE.setup(state, 0, setupCtx())
    resetPlaceIds()
    MARQUISE.setup(state, 1, setupCtx())

    for (const seat of [0, 1] as const) {
      const keep = keepCornerFor(state, seat)
      const allowed = new Set([keep, ...FALL.adjacent(keep)])
      for (let c = 0; c < 12; c++) {
        if (allowed.has(c)) {
          expect(warriors(state, c, seat)).toBe(1)
        } else {
          expect(warriors(state, c, seat)).toBe(0)
        }
      }
    }
  })

  it('Rule: Marquise > Setup 4–5 — buildings keep then adjacent by id; tracks leftmost empty', () => {
    const state = minimalState({
      players: [player(0, 'marquise')],
    })
    MARQUISE.setup(state, 0, setupCtx())
    const keep = FALL.corners[0]!
    const zone = [keep, ...FALL.adjacent(keep)]

    const buildings = zone.flatMap((id) =>
      state.clearings[id]!.pieces.filter((p) => p.kind === 'building'),
    )
    expect(buildings).toHaveLength(3)
    expect(buildings.map((b) => b.kind === 'building' && b.type).sort()).toEqual([
      'recruiter',
      'sawmill',
      'workshop',
    ])
    expect(state.clearings[keep]!.pieces.some((p) => p.kind === 'building')).toBe(true)

    const board = state.players[0]!.board
    expect(board.kind).toBe('marquise')
    if (board.kind === 'marquise') {
      expect(board.tracks.sawmill.placed).toBe(5)
      expect(board.tracks.workshop.placed).toBe(5)
      expect(board.tracks.recruiter.placed).toBe(5)
      expect(board.supply.warriors).toBe(25 - 11)
    }
  })

  it('House rule: buildings overflow to adjacent when keep slots full', () => {
    const state = minimalState({
      players: [player(0, 'marquise')],
    })
    // Corner 0 has 1 slot — only one building fits on keep.
    MARQUISE.setup(state, 0, setupCtx())
    const keep = FALL.corners[0]!
    const onKeep = state.clearings[keep]!.pieces.filter((p) => p.kind === 'building').length
    expect(onKeep).toBe(1)

    const adjacentIds = FALL.adjacent(keep)
    const onAdjacent = adjacentIds.reduce(
      (n, id) => n + state.clearings[id]!.pieces.filter((p) => p.kind === 'building').length,
      0,
    )
    expect(onAdjacent).toBe(2)
  })
})
