import { describe, expect, it } from 'vitest'
import type { ActionSpec, GameState } from '#api/client.ts'
import {
  BATTLE_OVER_MESSAGE,
  buildBattleOverlayViewModel,
  buildFinishedBattleOverlayViewModel,
  finishedBattleOutcomeFromLog,
  finishedOutcomeWithPiecesRemoved,
  readBattleClearingId,
  updateBattleTracker,
  ZERO_HIT_BATTLE_MESSAGE,
} from '#game/battleOverlayModel.ts'
import { makeActionSpec } from '#test/factories.ts'

function makeState(pending: unknown[]): GameState {
  return {
    id: 'g',
    seed: 1,
    status: 'playing',
    turn: 1,
    currentSeat: 1,
    phase: 'daylight',
    step: 'decree',
    factions: ['marquise', 'eyrie'],
    players: [
      { playerId: 'm', seat: 0, faction: 'marquise', vp: 0, hand: [] },
      { playerId: 'e', seat: 1, faction: 'eyrie', vp: 0, hand: [] },
    ],
    clearings: [],
    pending,
  }
}

const VAGABOND_SEAT = 0

function makeVagabondDefenderState(pending: unknown[]): GameState {
  const state: GameState = makeState(pending)
  return {
    ...state,
    factions: ['vagabond', 'eyrie'],
    players: state.players.map((player) =>
      player.seat === VAGABOND_SEAT ? { ...player, faction: 'vagabond' } : player,
    ),
  }
}

type BattleHits = { attacker: number; defender: number }

function makeRemovalBattle(hits: BattleHits): Record<string, unknown> {
  return {
    type: 'battle',
    clearing: 10,
    attacker: 1,
    defender: 0,
    stage: 'removeDefender',
    rolls: [3, 0],
    hits,
  }
}

function makeResolveEventSpec(
  params: NonNullable<ActionSpec['params']>,
): ActionSpec {
  return makeActionSpec({ type: 'resolveEvent', params })
}

describe('buildBattleOverlayViewModel', () => {
  it('returns null when no battle pending', () => {
    expect(buildBattleOverlayViewModel(makeState([]))).toBeNull()
  })

  it('shows rolls as attacker high / defender low', () => {
    const view = buildBattleOverlayViewModel(
      makeState([
        {
          type: 'battle',
          clearing: 10,
          attacker: 1,
          defender: 0,
          stage: 'removeDefender',
          rolls: [2, 1],
          hits: { attacker: 2, defender: 1 },
        },
      ]),
      'pick pieces',
    )
    expect(view).toEqual({
      clearing: 10,
      stage: 'removeDefender',
      attackerFaction: 'eyrie',
      defenderFaction: 'marquise',
      rolls: [2, 1],
      hits: { attacker: 2, defender: 1 },
      removal: { count: 2, unit: 'piece' },
      prompt: 'pick pieces',
      outcomeMessage: null,
    })
  })

  it('counts the pieces of the legal removal, not the hits dealt', () => {
    const view = buildBattleOverlayViewModel(
      makeState([makeRemovalBattle({ attacker: 3, defender: 0 })]),
      null,
      [makeResolveEventSpec({ pieceIds: ['w-1', 'w-2'] })],
    )
    expect(view?.removal).toEqual({ count: 2, unit: 'piece' })
    // One damage mark per piece removed.
    expect(view?.hits).toEqual({ attacker: 2, defender: 0 })
  })

  it('counts the items a Vagabond must damage', () => {
    const view = buildBattleOverlayViewModel(
      makeVagabondDefenderState([makeRemovalBattle({ attacker: 3, defender: 0 })]),
      null,
      [makeResolveEventSpec({ itemCount: [2] })],
    )
    expect(view?.removal).toEqual({ count: 2, unit: 'item' })
  })

  it('counts the hits a Vagabond takes when no item is left to choose', () => {
    const view = buildBattleOverlayViewModel(
      makeVagabondDefenderState([makeRemovalBattle({ attacker: 3, defender: 0 })]),
      null,
      [makeResolveEventSpec({ decline: [true] })],
    )
    expect(view?.removal).toEqual({ count: 3, unit: 'hit' })
  })

  it('has no removal outside the removal stages', () => {
    const view = buildBattleOverlayViewModel(
      makeState([{ ...makeRemovalBattle({ attacker: 0, defender: 0 }), stage: 'roll' }]),
    )
    expect(view?.removal).toBeNull()
  })

  it('hides overlay during ambush so banner resolves first', () => {
    expect(
      buildBattleOverlayViewModel(
        makeState([
          {
            type: 'battle',
            clearing: 4,
            attacker: 1,
            defender: 0,
            stage: 'ambush',
            hits: { attacker: 0, defender: 0 },
          },
        ]),
      ),
    ).toBeNull()
  })

  it('hides overlay during foil', () => {
    expect(
      buildBattleOverlayViewModel(
        makeState([
          {
            type: 'battle',
            clearing: 4,
            attacker: 1,
            defender: 0,
            stage: 'foil',
            hits: { attacker: 0, defender: 0 },
          },
        ]),
      ),
    ).toBeNull()
  })

  it('returns null clearing when no battle pending', () => {
    expect(readBattleClearingId(makeState([]))).toBeNull()
  })

  it('reads battle clearing id from pending', () => {
    expect(
      readBattleClearingId(
        makeState([
          {
            type: 'battle',
            clearing: 7,
            attacker: 1,
            defender: 0,
            stage: 'roll',
            hits: { attacker: 0, defender: 0 },
          },
        ]),
      ),
    ).toBe(7)
  })
})

describe('updateBattleTracker', () => {
  it('flashes zero-hit battle when pending clears after rolls', () => {
    const battlePending = makeState([
      {
        type: 'battle',
        clearing: 4,
        attacker: 1,
        defender: 0,
        stage: 'effects',
        rolls: [1, 0],
        hits: { attacker: 0, defender: 0 },
      },
    ])
    const tracked = updateBattleTracker(null, battlePending)
    expect(tracked.tracker?.rolls).toEqual([1, 0])
    expect(tracked.finishedOutcome).toBeNull()

    const resolved = updateBattleTracker(tracked.tracker, makeState([]))
    expect(resolved.tracker).toBeNull()
    expect(resolved.finishedOutcome).toEqual({
      clearing: 4,
      attacker: 1,
      defender: 0,
      rolls: [1, 0],
      hits: { attacker: 0, defender: 0 },
    })
  })

  it('flashes battle with hits when pending clears after rolls', () => {
    const battlePending = makeState([
      {
        type: 'battle',
        clearing: 2,
        attacker: 1,
        defender: 0,
        stage: 'removeDefender',
        rolls: [3, 1],
        hits: { attacker: 2, defender: 0 },
      },
    ])
    const tracked = updateBattleTracker(null, battlePending)
    const resolved = updateBattleTracker(tracked.tracker, makeState([]))
    expect(resolved.finishedOutcome).toEqual({
      clearing: 2,
      attacker: 1,
      defender: 0,
      rolls: [3, 1],
      hits: { attacker: 2, defender: 0 },
    })
  })

  it('does not flash ambush stage without rolls', () => {
    const battlePending = makeState([
      {
        type: 'battle',
        clearing: 2,
        attacker: 1,
        defender: 0,
        stage: 'ambush',
        hits: { attacker: 0, defender: 0 },
      },
    ])
    const tracked = updateBattleTracker(null, battlePending)
    const resolved = updateBattleTracker(tracked.tracker, makeState([]))
    expect(resolved.finishedOutcome).toBeNull()
  })
})

describe('buildFinishedBattleOverlayViewModel', () => {
  it('uses zero-hit copy when no hits', () => {
    const view = buildFinishedBattleOverlayViewModel(makeState([]), {
      clearing: 4,
      attacker: 1,
      defender: 0,
      rolls: [1, 0],
      hits: { attacker: 0, defender: 0 },
    })
    expect(view.outcomeMessage).toBe(ZERO_HIT_BATTLE_MESSAGE)
    expect(view.hits).toEqual({ attacker: 0, defender: 0 })
  })

  it('uses battle-over copy when hits landed', () => {
    const view = buildFinishedBattleOverlayViewModel(makeState([]), {
      clearing: 2,
      attacker: 1,
      defender: 0,
      rolls: [3, 1],
      hits: { attacker: 2, defender: 1 },
    })
    expect(view.outcomeMessage).toBe(BATTLE_OVER_MESSAGE)
    expect(view.rolls).toEqual([3, 1])
    expect(view.hits).toEqual({ attacker: 2, defender: 1 })
  })
})

describe('finishedBattleOutcomeFromLog', () => {
  const ATTACKER_SEAT = 0
  const DEFENDER_SEAT = 1
  const BATTLE_CLEARING = 3

  type LoggedBattleSeats = { attacker: number; defender: number }

  function loggedBattle(
    rolls: [number, number] | undefined,
    seats: LoggedBattleSeats = {
      attacker: ATTACKER_SEAT,
      defender: DEFENDER_SEAT,
    },
  ): unknown {
    return {
      t: 'event',
      event: {
        type: 'battle',
        clearing: BATTLE_CLEARING,
        stage: 'removeAttacker',
        ...seats,
        rolls,
        // Hits are back to zero once the pieces were taken.
        hits: { attacker: 0, defender: 0 },
      },
    }
  }

  it('counts the pieces removed after the roll as the hits', () => {
    const outcome = finishedBattleOutcomeFromLog([
      loggedBattle([2, 1]),
      {
        t: 'pieces',
        clearing: BATTLE_CLEARING,
        removed: [
          { id: 'd1', kind: 'warrior', owner: DEFENDER_SEAT },
          { id: 'd2', kind: 'warrior', owner: DEFENDER_SEAT },
        ],
      },
      {
        t: 'pieces',
        clearing: BATTLE_CLEARING,
        removed: [{ id: 'a1', kind: 'warrior', owner: ATTACKER_SEAT }],
      },
    ])
    expect(outcome).toEqual({
      clearing: BATTLE_CLEARING,
      attacker: ATTACKER_SEAT,
      defender: DEFENDER_SEAT,
      rolls: [2, 1],
      hits: { attacker: 2, defender: 1 },
    })
  })

  function removedPieces(owner: number, count: number): unknown {
    return {
      t: 'pieces',
      clearing: BATTLE_CLEARING,
      removed: Array.from({ length: count }, (_: undefined, index: number) => ({
        id: `p-${String(owner)}-${String(index)}`,
        kind: 'warrior',
        owner,
      })),
    }
  }

  it('counts the pieces removed between the opening and the roll entry', () => {
    const outcome = finishedBattleOutcomeFromLog([
      // An earlier loss in the same clearing is not this battle.
      removedPieces(DEFENDER_SEAT, 1),
      loggedBattle(undefined),
      removedPieces(DEFENDER_SEAT, 2),
      loggedBattle([3, 0]),
    ])
    expect(outcome?.hits).toEqual({ attacker: 2, defender: 0 })
  })

  it('counts the pieces removed when the opening entry carries the dice', () => {
    const outcome = finishedBattleOutcomeFromLog([
      loggedBattle([1, 0]),
      removedPieces(DEFENDER_SEAT, 1),
      loggedBattle([1, 0]),
    ])
    expect(outcome?.hits).toEqual({ attacker: 1, defender: 0 })
  })

  it('shows the pieces removed, not the hits dealt, on a tracked battle', () => {
    const tracked = {
      clearing: BATTLE_CLEARING,
      attacker: ATTACKER_SEAT,
      defender: DEFENDER_SEAT,
      rolls: [3, 0] as const,
      hits: { attacker: 3, defender: 0 },
    }
    const outcome = finishedOutcomeWithPiecesRemoved(makeState([]), tracked, [
      loggedBattle(undefined),
      removedPieces(DEFENDER_SEAT, 2),
      loggedBattle([3, 0]),
    ])
    expect(outcome.hits).toEqual({ attacker: 2, defender: 0 })
  })

  it('keeps the hits a Vagabond took, as it loses no piece', () => {
    const tracked = {
      clearing: BATTLE_CLEARING,
      attacker: DEFENDER_SEAT,
      defender: ATTACKER_SEAT,
      rolls: [3, 0] as const,
      hits: { attacker: 3, defender: 0 },
    }
    const outcome = finishedOutcomeWithPiecesRemoved(
      makeVagabondDefenderState([]),
      tracked,
      [
        loggedBattle([3, 0], {
          attacker: DEFENDER_SEAT,
          defender: ATTACKER_SEAT,
        }),
      ],
    )
    expect(outcome.hits).toEqual({ attacker: 3, defender: 0 })
  })

  it('is null without a rolled battle', () => {
    expect(finishedBattleOutcomeFromLog([{ t: 'start' }])).toBeNull()
    expect(finishedBattleOutcomeFromLog([loggedBattle(undefined)])).toBeNull()
  })
})

describe('ZERO_HIT_BATTLE_MESSAGE', () => {
  it('is user-facing copy', () => {
    expect(ZERO_HIT_BATTLE_MESSAGE).toBe('Battle over — no hits')
  })
})
