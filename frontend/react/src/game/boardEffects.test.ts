import { describe, expect, it } from 'vitest'
import {
  battleEffectBetween,
  boardEffectsBetween,
  logEntriesAddedSince,
  moveStepsFromLog,
  pieceEffectsBetween,
  type BoardEffectClearing,
  type BoardEffectPiece,
  type BoardEffectState,
  type BoardMoveStep,
} from '#game/boardEffects.ts'

const CAT_SEAT = 0
const CULT_SEAT = 2

function warrior(id: string, owner: number): BoardEffectPiece {
  return { id, kind: 'warrior', owner }
}

function building(id: string, owner: number, type: string): BoardEffectPiece {
  return { id, kind: 'building', owner, type }
}

/** A board of three clearings holding the given pieces. */
function board(
  first: BoardEffectPiece[],
  second: BoardEffectPiece[] = [],
  third: BoardEffectPiece[] = [],
): BoardEffectClearing[] {
  return [{ pieces: first }, { pieces: second }, { pieces: third }]
}

function battleEvent(clearing: number, stage: string): Record<string, unknown> {
  return {
    type: 'battle',
    clearing,
    attacker: CAT_SEAT,
    defender: CULT_SEAT,
    stage,
  }
}

function state(overrides: Partial<BoardEffectState>): BoardEffectState {
  return { id: 'game', clearings: board([]), pending: [], ...overrides }
}

/** Log entries of moves, as the server writes them: removed, then placed. */
function moveLogEntries(
  steps: readonly BoardMoveStep[],
): Record<string, unknown>[] {
  return steps.flatMap((step: BoardMoveStep): Record<string, unknown>[] => [
    { t: 'pieces', clearing: step.from, removed: step.pieces },
    { t: 'pieces', clearing: step.to, placed: step.pieces },
  ])
}

describe('moveStepsFromLog', () => {
  it('reads each removed-then-placed pair as one step, in order', () => {
    const steps: BoardMoveStep[] = [
      { from: 0, to: 1, pieces: [warrior('a', CAT_SEAT)] },
      { from: 1, to: 2, pieces: [warrior('b', CAT_SEAT), warrior('a', CAT_SEAT)] },
    ]
    expect(moveStepsFromLog(moveLogEntries(steps))).toEqual(steps)
  })

  it('skips placements, removals and other entries', () => {
    expect(
      moveStepsFromLog([
        { t: 'action', actor: CAT_SEAT },
        { t: 'pieces', clearing: 0, removed: [warrior('a', CAT_SEAT)] },
        { t: 'pieces', clearing: 1, placed: [warrior('new', CAT_SEAT)] },
      ]),
    ).toEqual([])
  })
})

describe('logEntriesAddedSince', () => {
  const log: string[] = ['join', 'start', 'action']

  it('returns the entries past the earlier length', () => {
    expect(logEntriesAddedSince(2, log)).toEqual(['action'])
  })

  it('returns nothing before a log was loaded or after it restarted', () => {
    expect(logEntriesAddedSince(0, log)).toEqual([])
    expect(logEntriesAddedSince(5, log)).toEqual([])
  })
})

describe('pieceEffectsBetween', () => {
  it('groups warriors moved together into one move with a count', () => {
    const effects = pieceEffectsBetween(
      board([warrior('a', CAT_SEAT), warrior('b', CAT_SEAT), warrior('c', CAT_SEAT)]),
      board([warrior('c', CAT_SEAT)], [warrior('a', CAT_SEAT), warrior('b', CAT_SEAT)]),
    )
    expect(effects).toEqual([
      {
        kind: 'move',
        from: 0,
        to: 1,
        fromSlot: { index: 0, total: 1 },
        toSlot: { index: 0, total: 1 },
        owner: CAT_SEAT,
        pieceKind: 'warrior',
        count: 2,
      },
    ])
  })

  it('points each effect at the stack the board draws for that group', () => {
    const effects = pieceEffectsBetween(
      board(
        [warrior('cat', CAT_SEAT), warrior('cult', CULT_SEAT)],
        [building('garden', CULT_SEAT, 'garden')],
      ),
      board(
        [warrior('cat', CAT_SEAT)],
        [building('garden', CULT_SEAT, 'garden'), warrior('cult', CULT_SEAT)],
      ),
    )
    // Left as the second of two stacks, arrives as the second of two stacks.
    expect(effects).toMatchObject([
      {
        kind: 'move',
        fromSlot: { index: 1, total: 2 },
        toSlot: { index: 1, total: 2 },
      },
    ])
  })

  it('keeps a removal on the stack that is left, else where the stack was', () => {
    const before = board([
      warrior('cat', CAT_SEAT),
      warrior('cult1', CULT_SEAT),
      warrior('cult2', CULT_SEAT),
    ])
    const oneLeft = pieceEffectsBetween(
      before,
      board([warrior('cat', CAT_SEAT), warrior('cult1', CULT_SEAT)]),
    )
    expect(oneLeft).toMatchObject([
      { kind: 'remove', count: 1, slot: { index: 1, total: 2 } },
    ])
    const noneLeft = pieceEffectsBetween(before, board([warrior('cat', CAT_SEAT)]))
    expect(noneLeft).toMatchObject([
      { kind: 'remove', count: 2, slot: { index: 1, total: 2 } },
    ])
  })

  it('reports new pieces as placed and missing pieces as removed', () => {
    const effects = pieceEffectsBetween(
      board([building('sawmill', CAT_SEAT, 'sawmill')]),
      board([building('garden', CULT_SEAT, 'garden'), warrior('w', CULT_SEAT)]),
    )
    expect(effects).toEqual([
      {
        kind: 'remove',
        clearing: 0,
        slot: { index: 0, total: 1 },
        owner: CAT_SEAT,
        pieceKind: 'building',
        pieceType: 'sawmill',
        count: 1,
      },
      {
        kind: 'place',
        clearing: 0,
        slot: { index: 0, total: 2 },
        stackCount: 1,
        owner: CULT_SEAT,
        pieceKind: 'building',
        pieceType: 'garden',
        count: 1,
      },
      {
        kind: 'place',
        clearing: 0,
        slot: { index: 1, total: 2 },
        stackCount: 1,
        owner: CULT_SEAT,
        pieceKind: 'warrior',
        count: 1,
      },
    ])
  })

  it('gives a placement the new size of its stack, not only what was added', () => {
    const effects = pieceEffectsBetween(
      board([warrior('a', CAT_SEAT), warrior('b', CAT_SEAT)]),
      board([warrior('a', CAT_SEAT), warrior('b', CAT_SEAT), warrior('c', CAT_SEAT)]),
    )
    expect(effects).toMatchObject([{ kind: 'place', count: 1, stackCount: 3 }])
  })

  it('reports nothing when the board did not change', () => {
    const pieces = board([warrior('a', CAT_SEAT)])
    expect(pieceEffectsBetween(pieces, pieces)).toEqual([])
  })
})

describe('battleEffectBetween', () => {
  it('reports a battle once, when it starts', () => {
    const started = battleEffectBetween([], [battleEvent(4, 'ambush')])
    expect(started).toEqual({
      kind: 'battle',
      clearing: 4,
      attacker: CAT_SEAT,
      defender: CULT_SEAT,
    })
    expect(
      battleEffectBetween(
        [battleEvent(4, 'ambush')],
        [battleEvent(4, 'removeDefender')],
      ),
    ).toBeNull()
  })

  it('reports nothing without a pending battle', () => {
    expect(battleEffectBetween([battleEvent(4, 'ambush')], [])).toBeNull()
  })
})

describe('boardEffectsBetween', () => {
  it('is empty for the first state and for another game', () => {
    const next = state({ clearings: board([warrior('a', CAT_SEAT)]) })
    expect(boardEffectsBetween(null, next)).toEqual([])
    expect(boardEffectsBetween(state({ id: 'other' }), next)).toEqual([])
  })

  it('puts a starting battle before the piece changes', () => {
    const effects = boardEffectsBetween(
      state({ clearings: board([warrior('a', CAT_SEAT)]) }),
      state({
        clearings: board([], [warrior('a', CAT_SEAT)]),
        pending: [battleEvent(1, 'ambush')],
      }),
    )
    expect(effects.map((effect) => effect.kind)).toEqual(['battle', 'move'])
  })

  it('tells both moves of a march whose first warrior leaves again', () => {
    const effects = boardEffectsBetween(
      state({
        clearings: board([warrior('a', CAT_SEAT)], [warrior('b', CAT_SEAT)]),
      }),
      state({
        clearings: board([], [], [warrior('b', CAT_SEAT), warrior('a', CAT_SEAT)]),
      }),
      moveLogEntries([
        { from: 0, to: 1, pieces: [warrior('a', CAT_SEAT)] },
        { from: 1, to: 2, pieces: [warrior('b', CAT_SEAT), warrior('a', CAT_SEAT)] },
      ]),
    )
    expect(effects).toMatchObject([
      { kind: 'move', from: 0, to: 1, count: 1 },
      { kind: 'move', from: 1, to: 2, count: 2 },
    ])
    expect(effects).toHaveLength(2)
  })

  it('still compares the boards for pieces the log does not move', () => {
    const effects = boardEffectsBetween(
      state({
        clearings: board([warrior('a', CAT_SEAT), warrior('cult', CULT_SEAT)]),
      }),
      state({
        clearings: board([], [warrior('a', CAT_SEAT), warrior('cult', CULT_SEAT)]),
      }),
      moveLogEntries([{ from: 0, to: 1, pieces: [warrior('a', CAT_SEAT)] }]),
    )
    expect(effects).toMatchObject([
      { kind: 'move', owner: CAT_SEAT, from: 0, to: 1, count: 1 },
      { kind: 'move', owner: CULT_SEAT, from: 0, to: 1, count: 1 },
    ])
  })

  it('ignores a wholesale board replacement such as a loaded snapshot', () => {
    const manyWarriors: BoardEffectPiece[] = Array.from(
      { length: 13 },
      (_unused: unknown, index: number): BoardEffectPiece =>
        // One owner per piece keeps every placement in its own group.
        warrior(`w${String(index)}`, index),
    )
    expect(
      boardEffectsBetween(state({}), state({ clearings: board(manyWarriors) })),
    ).toEqual([])
  })
})
