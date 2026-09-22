import { describe, expect, it } from 'vitest'
import type { ActionSpec, GameState, PlayerState } from '@root/lib'
import { redactLegalActionsForViewer } from './redactLegalActionsForViewer.js'

function marquisePlayer(playerId: string): PlayerState {
  return {
    playerId,
    seat: 0,
    faction: 'marquise',
    vp: 0,
    hand: [],
    playArea: [],
    craftedItems: [],
    board: {
      kind: 'marquise',
      supply: { warriors: 25, wood: 8 },
      tracks: {
        sawmill: { placed: 5 },
        workshop: { placed: 5 },
        recruiter: { placed: 5 },
      },
    },
  }
}

function eyriePlayer(playerId: string): PlayerState {
  return {
    playerId,
    seat: 1,
    faction: 'eyrie',
    vp: 0,
    hand: [],
    playArea: [],
    craftedItems: [],
    board: {
      kind: 'eyrie',
      supply: { warriors: 20 },
      leader: 'builder',
      leadersFaceUp: ['charismatic', 'commander', 'despot'],
      leadersFaceDown: [],
      decree: { recruit: [], move: [], battle: [], build: [] },
      roostTrack: { placed: 6 },
    },
  }
}

function makeState(players: PlayerState[]): GameState {
  return {
    id: 'test-game',
    seed: 1,
    map: 'fall',
    status: 'playing',
    turn: 1,
    currentSeat: 0,
    phase: 'daylight',
    step: 'actions',
    factions: ['marquise', 'eyrie'],
    players,
    clearings: Array.from({ length: 12 }, () => ({ pieces: [] })),
    deck: { draw: [], discard: [] },
    dominanceAvailable: [],
    itemSupply: {
      boot: 2,
      bag: 2,
      crossbow: 1,
      hammer: 1,
      sword: 2,
      tea: 2,
      coin: 2,
      torch: 1,
    },
    pending: [],
    turnScratch: {
      actionsLeft: 3,
      extraActions: 0,
      recruited: false,
      birdsongWoodDone: false,
      eveningDrawDone: false,
      swapMeetUsed: false,
      charmOffensiveUsed: false,
      leagueUsed: false,
      propagandaUsed: false,
      saboteursUsed: false,
      emergencyOrdersDone: false,
      eveningScoreDone: false,
      decree: null,
      decreeDone: false,
    },
  }
}

describe('redactLegalActionsForViewer', () => {
  it('keeps only viewer-seat actions so cardIds stay private', () => {
    const state = makeState([
      marquisePlayer('marquise'),
      eyriePlayer('eyrie'),
    ])
    const legalActions: ActionSpec[] = [
      {
        type: 'craft',
        actor: 0,
        params: { cardIds: ['secret-marquise-card'] },
      },
      {
        type: 'discard',
        actor: 1,
        params: { cardIds: ['secret-eyrie-card'] },
      },
    ]

    const forMarquise = redactLegalActionsForViewer(
      legalActions,
      state,
      'marquise',
    )
    const forEyrie = redactLegalActionsForViewer(
      legalActions,
      state,
      'eyrie',
    )

    expect(forMarquise).toEqual([legalActions[0]])
    expect(forEyrie).toEqual([legalActions[1]])
  })

  it('returns empty when viewer unknown', () => {
    const state = makeState([
      marquisePlayer('marquise'),
      eyriePlayer('eyrie'),
    ])
    const legalActions: ActionSpec[] = [{ type: 'endPhase', actor: 0 }]

    expect(
      redactLegalActionsForViewer(legalActions, state, 'vagabond'),
    ).toEqual([])
  })
})
