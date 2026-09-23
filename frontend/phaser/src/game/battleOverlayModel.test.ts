import { describe, expect, it } from 'vitest'
import type { GameState } from '#api/client.ts'
import {
  buildBattleOverlayViewModel,
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

  it('hides rolls before dice stage', () => {
    const view = buildBattleOverlayViewModel(
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
    )
    expect(view?.rolls).toBeNull()
    expect(view?.stage).toBe('ambush')
    expect(view?.outcomeMessage).toBeNull()
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
  it('detects zero-hit battle when pending clears after rolls', () => {
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
    expect(tracked.zeroHitOutcome).toBeNull()

    const resolved = updateBattleTracker(tracked.tracker, makeState([]))
    expect(resolved.tracker).toBeNull()
    expect(resolved.zeroHitOutcome).toEqual({
      clearing: 4,
      attacker: 1,
      defender: 0,
      rolls: [1, 0],
    })
  })

  it('does not flash when battle had hits before clearing', () => {
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
    expect(resolved.zeroHitOutcome).toBeNull()
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
    expect(resolved.zeroHitOutcome).toBeNull()
  })
})

describe('ZERO_HIT_BATTLE_MESSAGE', () => {
  it('is user-facing copy', () => {
    expect(ZERO_HIT_BATTLE_MESSAGE).toBe('Battle over — no hits')
  })
})
