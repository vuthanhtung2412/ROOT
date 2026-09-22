import { describe, expect, it } from 'vitest'
import type { GameState, PlayerState } from '@root/lib'
import { redactStateForViewer } from './redactStateForViewer.js'

function marquisePlayer(
  playerId: string,
  hand: Array<{ id: string; defId: string }>,
): PlayerState {
  return {
    playerId,
    seat: 0,
    faction: 'marquise',
    vp: 0,
    hand,
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

function eyriePlayer(
  playerId: string,
  hand: Array<{ id: string; defId: string }>,
): PlayerState {
  return {
    playerId,
    seat: 1,
    faction: 'eyrie',
    vp: 0,
    hand,
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
      emergencyOrdersDone: false,
      eveningScoreDone: false,
      decree: null,
      decreeDone: false,
    },
  }
}

describe('redactStateForViewer', () => {
  it('keeps viewer hand and empties opponent hand', () => {
    const state = makeState([
      marquisePlayer('marquise', [
        { id: 'c1', defId: 'fox_ambush' },
        { id: 'c2', defId: 'bird_armorers' },
      ]),
      eyriePlayer('eyrie', [
        { id: 'c3', defId: 'mouse_ambush' },
        { id: 'c4', defId: 'rabbit_boat' },
      ]),
    ])

    const forMarquise = redactStateForViewer(state, 'marquise')

    expect(forMarquise.players[0]?.hand).toEqual([
      { id: 'c1', defId: 'fox_ambush' },
      { id: 'c2', defId: 'bird_armorers' },
    ])
    expect(forMarquise.players[1]?.hand).toEqual([])
    expect(state.players[1]?.hand).toHaveLength(2)
  })

  it('does not mutate clearing pieces', () => {
    const state = makeState([
      marquisePlayer('marquise', [{ id: 'c1', defId: 'fox_ambush' }]),
      eyriePlayer('eyrie', [{ id: 'c2', defId: 'mouse_ambush' }]),
    ])
    const piece: { id: string; kind: 'warrior'; owner: 0 } = {
      id: 'w1',
      kind: 'warrior',
      owner: 0,
    }
    const withPiece: GameState = {
      ...state,
      clearings: state.clearings.map((clearing, index) =>
        index === 0 ? { pieces: [piece] } : clearing,
      ),
    }

    const redacted = redactStateForViewer(withPiece, 'eyrie')

    expect(redacted.clearings[0]?.pieces).toEqual([piece])
    expect(redacted.clearings[0]?.pieces[0]).toBe(piece)
  })
})
