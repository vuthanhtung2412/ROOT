import {
  appendFileSync,
  mkdirSync,
  existsSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatGameLogEntry,
  type Action,
  type GameState,
  type LogEntry,
} from '@root/lib'
import {
  buildGameEndSummary,
  formatGameEndSummary,
} from '#debug/gameEndSummary.js'

/** Repo root `./logs` (…/Root/logs), not cwd. */
const LOGS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../logs')
const GAME_LOG_MARKDOWN_FILE_NAME = 'game.md'
/** One event per line, appended: a long game never rewrites its history. */
const GAME_LOG_EVENTS_FILE_NAME = 'game.jsonl'
/**
 * Games logged at once, one log folder each. The least recently logged game
 * beyond this is forgotten; it opens a fresh folder if it ever logs again.
 */
export const MAXIMUM_OPEN_GAME_LOG_COUNT = 100

export type GameLogEventLabel = 'CREATE' | 'JOIN' | 'EXPEL' | 'START' | 'ACT' | 'UNDO' | 'LOAD'

/** Structured event for React / DevTools timeline scrubbing. */
export type GameLogEvent = {
  seq: number
  at: string
  label: GameLogEventLabel
  action?: Action
  /** Full state after this event. */
  state: GameState
}

/** One game → `logs/<stamp>/game.md` + `game.jsonl`. */
type GameLogSession = {
  directory: string
  openedAt: string
  /** Time of the START event; the end summary measures from it. */
  startedAt: string | null
  eventCount: number
  previousState: GameState | null
  /** One GAME END block per log folder. */
  gameEndSummaryLogged: boolean
}

/** By game id, least recently logged first. */
const sessionsByGameId = new Map<string, GameLogSession>()

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** `logs/dd-mm-yyyy-HHhMMm/` (collide → `-ss` / `-ss-N`). */
function newLogDir(now = new Date()): string {
  mkdirSync(LOGS_DIR, { recursive: true })
  const base =
    `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}` +
    `-${pad(now.getHours())}h${pad(now.getMinutes())}m`
  let path = join(LOGS_DIR, base)
  if (!existsSync(path)) return path
  path = join(LOGS_DIR, `${base}-${pad(now.getSeconds())}s`)
  if (!existsSync(path)) return path
  let i = 2
  while (existsSync(join(LOGS_DIR, `${base}-${pad(now.getSeconds())}s-${i}`))) i++
  return join(LOGS_DIR, `${base}-${pad(now.getSeconds())}s-${i}`)
}

function markdownPathOf(session: GameLogSession): string {
  return join(session.directory, GAME_LOG_MARKDOWN_FILE_NAME)
}

function eventsPathOf(session: GameLogSession): string {
  return join(session.directory, GAME_LOG_EVENTS_FILE_NAME)
}

/** Mark the game as the most recently logged, forgetting the oldest beyond the limit. */
function rememberSession(gameId: string, session: GameLogSession): void {
  sessionsByGameId.delete(gameId)
  sessionsByGameId.set(gameId, session)
  if (sessionsByGameId.size <= MAXIMUM_OPEN_GAME_LOG_COUNT) {
    return
  }
  const oldestGameId: string | undefined = sessionsByGameId.keys().next().value
  if (oldestGameId !== undefined) {
    sessionsByGameId.delete(oldestGameId)
  }
}

/** Open fresh log folder for the game (on CREATE, or its first logged event). */
function beginGameLog(gameId: string): GameLogSession {
  const directory: string = newLogDir()
  mkdirSync(directory, { recursive: true })
  const session: GameLogSession = {
    directory,
    openedAt: new Date().toISOString(),
    startedAt: null,
    eventCount: 0,
    previousState: null,
    gameEndSummaryLogged: false,
  }
  writeFileSync(
    markdownPathOf(session),
    `# Root game log\n\nOpened: ${session.openedAt}\n\n`,
    'utf8',
  )
  writeFileSync(eventsPathOf(session), '', 'utf8')
  rememberSession(gameId, session)
  console.log(`game log → ${directory}/`)
  return session
}

function sessionOf(gameId: string): GameLogSession {
  return sessionsByGameId.get(gameId) ?? beginGameLog(gameId)
}

/** Log folder of the game; opens one when the game was not logged yet. */
export function gameLogDirectory(gameId: string): string {
  return sessionOf(gameId).directory
}

/** Winner, VP, turns, duration — once when the game finishes. */
function logGameEndSummaryIfNeeded(session: GameLogSession, state: GameState): GameLogSession {
  if (state.status !== 'finished' || session.gameEndSummaryLogged) {
    return session
  }
  const summary = buildGameEndSummary({
    state,
    startedAtIso: session.startedAt ?? session.openedAt,
    endedAtIso: new Date().toISOString(),
  })
  const text = formatGameEndSummary(summary)
  console.log(text)
  appendFileSync(markdownPathOf(session), `\n## Game end\n\n${text}\n`, 'utf8')
  return { ...session, gameEndSummaryLogged: true }
}

/** Console + `game.md` / `game.jsonl` after each mutating game call. */
export function logGameEvent(
  label: GameLogEventLabel,
  state: GameState,
  action?: Action,
  turnLog?: LogEntry[],
): void {
  const session: GameLogSession =
    label === 'CREATE' ? beginGameLog(state.id) : sessionOf(state.id)

  const full = label === 'CREATE' || label === 'LOAD' || label === 'START'
  const text = formatGameLogEntry(state, {
    label,
    ...(action ? { action } : {}),
    ...(turnLog !== undefined && turnLog.length > 0 ? { turnLog } : {}),
    prev: full ? undefined : session.previousState,
    full,
  })
  console.log(text)

  appendFileSync(markdownPathOf(session), `${text}\n`, 'utf8')

  const event: GameLogEvent = {
    seq: session.eventCount,
    at: new Date().toISOString(),
    label,
    ...(action ? { action } : {}),
    state,
  }
  appendFileSync(eventsPathOf(session), `${JSON.stringify(event)}\n`, 'utf8')

  const loggedSession: GameLogSession = {
    ...session,
    startedAt: session.startedAt === null && label === 'START' ? event.at : session.startedAt,
    eventCount: session.eventCount + 1,
    // Cloned: the next event's diff must see this state as it is now.
    previousState: structuredClone(state),
  }
  rememberSession(state.id, logGameEndSummaryIfNeeded(loggedSession, state))
}
