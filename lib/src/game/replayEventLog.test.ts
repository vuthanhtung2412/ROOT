import { describe, expect, it } from 'vitest'
import type { Action } from '#actions/types.js'
import { Game } from '#game/Game.js'
import {
  isLoggedGame,
  snapshotAtLoggedEvent,
  type LoggedGame,
  type LoggedGameEvent,
} from '#game/replayEventLog.js'
import { createPlayingGame } from '#test/fixtures.js'

const SEED = 31

/** Log a game the way the web server does: CREATE, then one event per action. */
function loggedGameOf(game: Game): LoggedGame {
  const replayed: Game = Game.create({
    seed: game.state.seed,
    factions: [...game.state.factions],
  })
  const events: LoggedGameEvent[] = [
    { seq: 0, label: 'CREATE', state: structuredClone(replayed.state) },
  ]
  for (const action of game.history) {
    replayed.apply(action)
    events.push({
      seq: events.length,
      label: 'ACT',
      action,
      state: structuredClone(replayed.state),
    })
  }
  return { events }
}

function withUndoAfter(loggedGame: LoggedGame, seq: number): LoggedGame {
  const undone: LoggedGameEvent = loggedGame.events[seq]!
  const before: LoggedGameEvent = loggedGame.events[seq - 1]!
  const undoEvent: LoggedGameEvent = {
    seq: seq + 1,
    label: 'UNDO',
    state: structuredClone(before.state),
  }
  return { events: [...loggedGame.events.slice(0, undone.seq + 1), undoEvent] }
}

describe('snapshotAtLoggedEvent', () => {
  it('rebuilds the state logged right after the chosen event', () => {
    const loggedGame: LoggedGame = loggedGameOf(createPlayingGame({ seed: SEED }))
    const target: LoggedGameEvent = loggedGame.events.at(-1)!

    const snapshot = snapshotAtLoggedEvent(loggedGame, target.seq)

    expect(snapshot.state).toEqual(target.state)
  })

  it('stops at the chosen event, not at the end of the log', () => {
    const loggedGame: LoggedGame = loggedGameOf(createPlayingGame({ seed: SEED }))
    const middleSeq: number = Math.floor(loggedGame.events.length / 2)

    const snapshot = snapshotAtLoggedEvent(loggedGame, middleSeq)

    expect(snapshot.state).toEqual(loggedGame.events[middleSeq]!.state)
    expect(snapshot.history).toHaveLength(middleSeq)
  })

  it('keeps the dice of the logged game for the actions played next', () => {
    const played: Game = createPlayingGame({ seed: SEED })
    const loggedGame: LoggedGame = loggedGameOf(played)

    const snapshot = snapshotAtLoggedEvent(loggedGame, loggedGame.events.at(-1)!.seq)

    expect(snapshot.rng).toEqual(played.toJSON().rng)
  })

  it('drops the action an UNDO event took back', () => {
    const loggedGame: LoggedGame = loggedGameOf(createPlayingGame({ seed: SEED }))
    const lastSeq: number = loggedGame.events.at(-1)!.seq
    const withUndo: LoggedGame = withUndoAfter(loggedGame, lastSeq)

    const snapshot = snapshotAtLoggedEvent(withUndo, lastSeq + 1)

    expect(snapshot.state).toEqual(loggedGame.events[lastSeq - 1]!.state)
  })

  it('refuses a log that loads a snapshot: its seed no longer explains the state', () => {
    const loggedGame: LoggedGame = loggedGameOf(createPlayingGame({ seed: SEED }))
    const first: LoggedGameEvent = loggedGame.events[1]!
    const withLoad: LoggedGame = {
      events: [loggedGame.events[0]!, { ...first, label: 'LOAD' }],
    }

    expect(() => snapshotAtLoggedEvent(withLoad, first.seq)).toThrow(/loads a snapshot/)
  })

  it('refuses an event number the log does not hold', () => {
    const loggedGame: LoggedGame = loggedGameOf(createPlayingGame({ seed: SEED }))

    expect(() => snapshotAtLoggedEvent(loggedGame, loggedGame.events.length)).toThrow(
      /no event/,
    )
  })
})

describe('isLoggedGame', () => {
  it('accepts a logged game and rejects other shapes', () => {
    const loggedGame: LoggedGame = loggedGameOf(createPlayingGame({ seed: SEED }))
    const actionWithoutType: Partial<Action> = {}

    expect(isLoggedGame(structuredClone(loggedGame))).toBe(true)
    expect(isLoggedGame({ events: [{ seq: 0, label: 'CREATE' }] })).toBe(false)
    expect(
      isLoggedGame({
        events: [{ ...loggedGame.events[1]!, action: actionWithoutType }],
      }),
    ).toBe(false)
  })
})
