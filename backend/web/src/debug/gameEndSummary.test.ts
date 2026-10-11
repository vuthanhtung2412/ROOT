import { describe, expect, it } from 'vitest'
import {
  buildGameEndSummary,
  formatDurationLabel,
  formatGameEndSummary,
} from '#debug/gameEndSummary.js'
import { createTwoPlayerGameState } from '#test/gameStateFixtures.js'

describe('formatDurationLabel', () => {
  it('formats seconds, minutes, and hours', () => {
    expect(formatDurationLabel(5_000)).toBe('5s')
    expect(formatDurationLabel(125_000)).toBe('2m 5s')
    expect(formatDurationLabel(3_725_000)).toBe('1h 2m 5s')
  })
})

describe('buildGameEndSummary', () => {
  it('reads winner, VP, turns, and duration from the finished state', () => {
    const state = createTwoPlayerGameState([
      { playerId: 'alice' },
      { playerId: 'bob' },
    ])
    state.status = 'finished'
    state.winner = 0
    state.turn = 13
    state.players[0]!.vp = 30
    state.players[1]!.vp = 22

    const summary = buildGameEndSummary({
      state,
      startedAtIso: '2026-10-10T20:00:00.000Z',
      endedAtIso: '2026-10-10T20:45:30.000Z',
    })

    expect(summary.winnerSeat).toBe(0)
    expect(summary.winnerPlayerId).toBe('alice')
    expect(summary.winnerFaction).toBe('marquise')
    expect(summary.turns).toBe(13)
    expect(summary.durationMilliseconds).toBe(45 * 60 * 1000 + 30 * 1000)
    expect(summary.victoryPointsByPlayer).toEqual([
      {
        seat: 0,
        playerId: 'alice',
        faction: state.players[0]!.faction,
        victoryPoints: 30,
      },
      {
        seat: 1,
        playerId: 'bob',
        faction: state.players[1]!.faction,
        victoryPoints: 22,
      },
    ])
  })
})

describe('formatGameEndSummary', () => {
  it('prints a stable GAME END block', () => {
    const text = formatGameEndSummary({
      winnerSeat: 0,
      winnerPlayerId: 'alice',
      winnerFaction: 'marquise',
      victoryPointsByPlayer: [
        {
          seat: 0,
          playerId: 'alice',
          faction: 'marquise',
          victoryPoints: 30,
        },
        {
          seat: 1,
          playerId: 'bob',
          faction: 'eyrie',
          victoryPoints: 18,
        },
      ],
      turns: 13,
      durationMilliseconds: 125_000,
    })

    expect(text).toBe(
      [
        'GAME END',
        'winner: seat0 marquise (alice)',
        'VP:',
        '  seat0 marquise alice: 30 VP',
        '  seat1 eyrie bob: 18 VP',
        'turns: 13',
        'duration: 2m 5s',
      ].join('\n'),
    )
  })
})
