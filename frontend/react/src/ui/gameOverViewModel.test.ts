import { describe, expect, it } from 'vitest'
import type { GameState } from '#api/client.ts'
import { makeGameState } from '#test/factories.ts'
import { buildGameOverView } from '#ui/gameOverViewModel.ts'

type GamePlayer = GameState['players'][number]

function seated(seat: number, faction: string, vp: number): GamePlayer {
  return { playerId: `player-${String(seat)}`, seat, faction, vp, hand: [] }
}

/** Finished co-op table: Alliance and Vagabond against both bots. */
function cooperativeFinish(winningTeam: 'humans' | 'bots', winner: number): GameState {
  return {
    ...makeGameState({ status: 'finished' }),
    cooperative: true,
    winner,
    winningTeam,
    factions: ['alliance', 'vagabond', 'mechanicalMarquise', 'electricEyrie'],
    players: [
      seated(0, 'alliance', 33),
      seated(1, 'vagabond', 30),
      seated(2, 'mechanicalMarquise', 21),
      seated(3, 'electricEyrie', 28),
    ],
  }
}

describe('buildGameOverView', () => {
  it('nothing while the game goes on', () => {
    expect(buildGameOverView(makeGameState({ status: 'playing' }))).toBeNull()
  })

  it('co-op win: the Woodland holds, its scores first', () => {
    expect(buildGameOverView(cooperativeFinish('humans', 0))).toEqual({
      title: 'The Woodland holds',
      scoreLine:
        'Woodland Alliance 33 · Vagabond 30 — Mechanical Marquise 21 · Electric Eyrie 28',
    })
  })

  it('co-op loss: the Clockwork wins, the bots scores first', () => {
    expect(buildGameOverView(cooperativeFinish('bots', 3))).toEqual({
      title: 'The Clockwork wins',
      scoreLine:
        'Mechanical Marquise 21 · Electric Eyrie 28 — Woodland Alliance 33 · Vagabond 30',
    })
  })

  it('free-for-all: the winning faction alone', () => {
    const finished: GameState = { ...makeGameState({ status: 'finished' }), winner: 1 }

    expect(buildGameOverView(finished)).toEqual({ title: 'Eyrie Dynasties wins', scoreLine: null })
  })
})
