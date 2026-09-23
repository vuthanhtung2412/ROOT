import { describe, expect, it } from 'vitest'
import type { ActionSpec, GameState } from '#api/client.ts'
import { buildTurnBannerViewModel } from '#ui/TurnBanner.ts'

function makeState(overrides: {
  currentSeat?: number
  pending?: unknown[]
  status?: GameState['status']
  phase?: GameState['phase']
  step?: string
}): GameState {
  return {
    id: 'g',
    seed: 1,
    status: overrides.status ?? 'playing',
    turn: 1,
    currentSeat: overrides.currentSeat ?? 1,
    phase: overrides.phase ?? 'daylight',
    step: overrides.step ?? 'decree',
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

  it('Field Hospitals uses victim actor but no banner prompt', () => {
    const view = buildTurnBannerViewModel(
      makeState({
        currentSeat: 1,
        pending: [
          { type: 'fieldHospital', victim: 0, clearing: 10, count: 2 },
        ],
      }),
    )
    expect(view.actorSeat).toBe(0)
    expect(view.prompt).not.toContain('Field Hospitals')
    expect(view.prompt).toBe('Resolve decree columns')
  })

  it('setup prompts keep → building → leader in order', () => {
    expect(
      buildTurnBannerViewModel(
        makeState({
          status: 'setup',
          pending: [{ type: 'chooseKeep', seat: 0 }],
        }),
      ).prompt,
    ).toBe('Choose keep corner')
    expect(
      buildTurnBannerViewModel(
        makeState({
          status: 'setup',
          pending: [
            { type: 'placeStartingBuilding', seat: 0, building: 'sawmill' },
          ],
        }),
      ).prompt,
    ).toBe('Place sawmill')
    expect(
      buildTurnBannerViewModel(
        makeState({
          status: 'setup',
          pending: [
            { type: 'placeStartingBuilding', seat: 0, building: 'workshop' },
          ],
        }),
      ).prompt,
    ).toBe('Place workshop')
    expect(
      buildTurnBannerViewModel(
        makeState({
          status: 'setup',
          pending: [
            { type: 'placeStartingBuilding', seat: 0, building: 'recruiter' },
          ],
        }),
      ).prompt,
    ).toBe('Place recruiter')
    expect(
      buildTurnBannerViewModel(
        makeState({
          status: 'setup',
          pending: [{ type: 'chooseLeader', seat: 1, reason: 'setup' }],
        }),
      ).prompt,
    ).toBe('Choose Eyrie leader')
  })

  it('describes battle removal stages', () => {
    expect(
      buildTurnBannerViewModel(
        makeState({
          pending: [
            {
              type: 'battle',
              clearing: 3,
              attacker: 1,
              defender: 0,
              stage: 'removeDefender',
              hits: { attacker: 2, defender: 0 },
            },
          ],
        }),
      ).prompt,
    ).toBe('Battle — remove defender pieces')
  })

  it('describes daylight steps outside pending events', () => {
    expect(
      buildTurnBannerViewModel(
        makeState({ phase: 'daylight', step: 'craft', pending: [] }),
      ).prompt,
    ).toBe('Craft step — craft or end craft')
    expect(
      buildTurnBannerViewModel(
        makeState({ phase: 'birdsong', step: 'newRoost', pending: [] }),
      ).prompt,
    ).toBe('Birdsong')
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
