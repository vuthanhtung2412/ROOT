import { describe, expect, it } from 'vitest'
import type { ActionSpec, GameState } from '../api/client.ts'
import { buildTurnBannerViewModel } from './TurnBanner.ts'

function makeState(overrides: {
  currentSeat?: number
  pending?: unknown[]
}): GameState {
  return {
    id: 'g',
    seed: 1,
    status: 'playing',
    turn: 1,
    currentSeat: overrides.currentSeat ?? 1,
    phase: 'daylight',
    step: 'decree',
    factions: ['marquise', 'eyrie'],
    players: [
      {
        playerId: 'm',
        seat: 0,
        faction: 'marquise',
        vp: 0,
        hand: [],
      },
      {
        playerId: 'e',
        seat: 1,
        faction: 'eyrie',
        vp: 0,
        hand: [],
      },
    ],
    clearings: [],
    pending: overrides.pending ?? [],
  }
}

describe('buildTurnBannerViewModel pending actor', () => {
  it('uses battle ambush defender not currentSeat', () => {
    const view = buildTurnBannerViewModel(
      makeState({
        currentSeat: 1,
        pending: [
          {
            type: 'battle',
            clearing: 10,
            attacker: 1,
            defender: 0,
            stage: 'ambush',
            hits: { attacker: 0, defender: 0 },
          },
        ],
      }),
    )
    expect(view.actorSeat).toBe(0)
    expect(view.actorFaction).toBe('marquise')
  })

  it('prefers legalActions actor for effects stage', () => {
    const legal: ActionSpec[] = [
      {
        type: 'resolveEvent',
        actor: 0,
        params: { useEffect: [false] },
      },
    ]
    const view = buildTurnBannerViewModel(
      makeState({
        currentSeat: 1,
        pending: [
          {
            type: 'battle',
            clearing: 3,
            attacker: 1,
            defender: 0,
            stage: 'effects',
            effectsOrder: [1, 0],
            effectsUsed: { attacker: true },
            hits: { attacker: 1, defender: 1 },
          },
        ],
      }),
      legal,
    )
    expect(view.actorSeat).toBe(0)
  })
})
