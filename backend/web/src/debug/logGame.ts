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

/** Repo root `./logs` (…/Root/logs), not cwd. */
const LOGS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../logs')

/** One game session → `logs/<stamp>/game.md` + `game.json`. */
let currentLogDir: string | null = null
let prevLogState: GameState | null = null
let session: GameSessionLog | null = null

export type GameLogEventLabel = 'CREATE' | 'JOIN' | 'START' | 'ACT' | 'UNDO' | 'LOAD'

/** Structured event for React / DevTools timeline scrubbing. */
export type GameLogEvent = {
  seq: number
  at: string
  label: GameLogEventLabel
  action?: Action
  /** Full state after this event. */
  state: GameState
}

export type GameSessionLog = {
  version: 1
  openedAt: string
  dir: string
  events: GameLogEvent[]
}

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

function mdPath(): string {
  return join(currentLogDir!, 'game.md')
}

function jsonPath(): string {
  return join(currentLogDir!, 'game.json')
}

function writeJson(): void {
  if (!session) return
  writeFileSync(jsonPath(), `${JSON.stringify(session, null, 2)}\n`, 'utf8')
}

/** Open fresh log folder for a new game (call on CREATE). */
export function beginGameLog(): string {
  currentLogDir = newLogDir()
  mkdirSync(currentLogDir, { recursive: true })
  prevLogState = null
  const openedAt = new Date().toISOString()
  session = {
    version: 1,
    openedAt,
    dir: currentLogDir,
    events: [],
  }
  writeFileSync(
    mdPath(),
    `# Root game log\n\nOpened: ${openedAt}\n\n`,
    'utf8',
  )
  writeJson()
  return currentLogDir
}

/** Console + `game.md` / `game.json` after each mutating game call. */
export function logGameEvent(
  label: GameLogEventLabel,
  state: GameState,
  action?: Action,
  turnLog?: LogEntry[],
): void {
  if (label === 'CREATE') {
    const dir = beginGameLog()
    console.log(`game log → ${dir}/`)
  }

  if (!currentLogDir || !session) beginGameLog()

  const full = label === 'CREATE' || label === 'LOAD' || label === 'START'
  const text = formatGameLogEntry(state, {
    label,
    ...(action ? { action } : {}),
    ...(turnLog !== undefined && turnLog.length > 0 ? { turnLog } : {}),
    prev: full ? undefined : prevLogState,
    full,
  })
  console.log(text)

  appendFileSync(mdPath(), `${text}\n`, 'utf8')

  const event: GameLogEvent = {
    seq: session!.events.length,
    at: new Date().toISOString(),
    label,
    ...(action ? { action } : {}),
    state: structuredClone(state),
  }
  session!.events.push(event)
  writeJson()

  prevLogState = structuredClone(state)
}
