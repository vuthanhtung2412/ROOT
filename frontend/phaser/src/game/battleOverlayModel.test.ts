import { describe, expect, it } from 'vitest'
import type { GameState } from '#api/client.ts'
import { buildBattleOverlayViewModel } from '#game/battleOverlayModel.ts'

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
  })
})
