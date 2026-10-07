import { describe, expect, it } from 'vitest'
import type { GameState } from '#api/client.ts'
import {
  BATTLE_OVER_MESSAGE,
  buildBattleOverlayViewModel,
  buildFinishedBattleOverlayViewModel,
  finishedBattleOutcomeFromLog,
  readBattleClearingId,
  updateBattleTracker,
  ZERO_HIT_BATTLE_MESSAGE,
} from '#game/battleOverlayModel.ts'

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
      prompt: 'pick pieces',
      outcomeMessage: null,
    })
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

  function loggedBattle(rolls: [number, number] | undefined): unknown {
    return {
      t: 'event',
      event: {
        type: 'battle',
        clearing: BATTLE_CLEARING,
        stage: 'removeAttacker',
        attacker: ATTACKER_SEAT,
        defender: DEFENDER_SEAT,
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
