import type { ActionSpec, GameState } from '../api/client.ts'

/** Fixture factories for Phaser unit tests — no live server. */

export function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'test-game',
    seed: 1,
    status: 'playing',
    turn: 1,
    currentSeat: 0,
    phase: 'daylight',
    step: 'actions',
    factions: ['marquise', 'eyrie'],
    players: [
      {
        playerId: 'marquise',
        seat: 0,
        faction: 'marquise',
        vp: 0,
        hand: [{ id: 'ROOT-205#1', defId: 'ROOT-205' }],
      },
      {
        playerId: 'eyrie',
        seat: 1,
        faction: 'eyrie',
        vp: 0,
        hand: [],
      },
    ],
    clearings: Array.from({ length: 12 }, () => ({ pieces: [] })),
    pending: [],
    ...overrides,
  }
}

export function makeActionSpec(overrides: Partial<ActionSpec> = {}): ActionSpec {
  return {
    type: 'endPhase',
    actor: 0,
    ...overrides,
  }
}

export function makeFetchResponse(body: unknown, status = 200): Response {
  if (status === 204) {
    return new Response(null, { status })
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
