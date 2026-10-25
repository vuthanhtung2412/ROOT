import type { Action } from '#actions/types.js'
import { Game } from '#game/Game.js'
import type { GameSnapshot } from '#state/snapshot.js'
import type { GameState } from '#state/types.js'

/** Labels the web server writes in `logs/<stamp>/game.jsonl`. */
const CREATE_LABEL = 'CREATE'
const UNDO_LABEL = 'UNDO'
const LOAD_LABEL = 'LOAD'
const EVENT_LINES_FILE_EXTENSION = '.jsonl'

/** One entry of a game log: what happened and the state right after it. */
export type LoggedGameEvent = {
  seq: number
  label: string
  action?: Action
  state: GameState
}

export type LoggedGame = {
  events: LoggedGameEvent[]
}

type JsonRecord = Record<string, unknown>

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLoggedAction(value: unknown): value is Action | undefined {
  if (value === undefined) return true
  return isJsonRecord(value) && typeof value.type === 'string'
}

function isLoggedGameState(value: unknown): value is GameState {
  return (
    isJsonRecord(value) &&
    typeof value.seed === 'number' &&
    Array.isArray(value.factions)
  )
}

function isLoggedGameEvent(value: unknown): value is LoggedGameEvent {
  return (
    isJsonRecord(value) &&
    typeof value.seq === 'number' &&
    typeof value.label === 'string' &&
    isLoggedAction(value.action) &&
    isLoggedGameState(value.state)
  )
}

/** Narrow the parsed content of a `game.json` file. */
export function isLoggedGame(value: unknown): value is LoggedGame {
  return (
    isJsonRecord(value) &&
    Array.isArray(value.events) &&
    value.events.every(isLoggedGameEvent)
  )
}

/**
 * Read a game log file: `game.jsonl` holds one event per line (appended as the
 * game goes), older `game.json` files hold every event in one `events` list.
 */
export function parseLoggedGameFile(fileName: string, content: string): unknown {
  if (!fileName.endsWith(EVENT_LINES_FILE_EXTENSION)) {
    return JSON.parse(content)
  }
  const events: unknown[] = content
    .split('\n')
    .filter((line: string): boolean => line.trim() !== '')
    .map((line: string): unknown => JSON.parse(line))
  return { events }
}

/** Actions still standing at `untilSeq`: an UNDO drops the action before it. */
function actionsUntil(
  events: readonly LoggedGameEvent[],
  untilSeq: number,
): Action[] {
  const actions: Action[] = []
  for (const event of events) {
    if (event.seq > untilSeq) break
    if (event.label === LOAD_LABEL) {
      throw new Error(
        `event ${event.seq} loads a snapshot: the log cannot be replayed from its seed`,
      )
    }
    if (event.label === UNDO_LABEL) {
      actions.pop()
      continue
    }
    if (event.action !== undefined) actions.push(event.action)
  }
  return actions
}

/**
 * Rebuild the game as it stood right after event `untilSeq` by replaying the
 * logged actions from the logged seed. Shuffles and dice come from that seed,
 * so they fall exactly as in the logged game, also for the actions played next.
 */
export function snapshotAtLoggedEvent(
  loggedGame: LoggedGame,
  untilSeq: number,
): GameSnapshot {
  const created: LoggedGameEvent | undefined = loggedGame.events[0]
  if (created === undefined || created.label !== CREATE_LABEL) {
    throw new Error('the log does not start with a CREATE event')
  }
  const target: LoggedGameEvent | undefined = loggedGame.events.find(
    (event: LoggedGameEvent): boolean => event.seq === untilSeq,
  )
  if (target === undefined) {
    throw new Error(`no event ${untilSeq} in the log`)
  }
  const game: Game = Game.replay(
    created.state.seed,
    actionsUntil(loggedGame.events, untilSeq),
    created.state.factions,
  )
  return game.toJSON()
}
