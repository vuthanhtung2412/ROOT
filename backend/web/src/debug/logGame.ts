import { appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatGameView, type Action, type GameState } from '@root/lib'

/** Repo root `./logs` (…/Root/logs), not cwd. */
const LOGS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../logs')

let currentLogFile: string | null = null

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** `dd-mm-yyyy-<hh>h<mm>m.log`; collide → append `-ss`. */
function newLogPath(now = new Date()): string {
  mkdirSync(LOGS_DIR, { recursive: true })
  const base =
    `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}` +
    `-${pad(now.getHours())}h${pad(now.getMinutes())}m`
  let path = join(LOGS_DIR, `${base}.log`)
  if (!existsSync(path)) return path
  path = join(LOGS_DIR, `${base}-${pad(now.getSeconds())}s.log`)
  if (!existsSync(path)) return path
  let i = 2
  while (existsSync(join(LOGS_DIR, `${base}-${pad(now.getSeconds())}s-${i}.log`))) i++
  return join(LOGS_DIR, `${base}-${pad(now.getSeconds())}s-${i}.log`)
}

/** Open fresh log file for a new game (call on CREATE). */
export function beginGameLog(): string {
  currentLogFile = newLogPath()
  appendFileSync(currentLogFile, `=== game log opened ${new Date().toISOString()} ===\n`, 'utf8')
  return currentLogFile
}

/** Console + file dump after each mutating game call. */
export function logGameEvent(label: string, state: GameState, action?: Action): void {
  if (label === 'CREATE') {
    const path = beginGameLog()
    console.log(`game log → ${path}`)
  }

  const text = formatGameView(state, { label, ...(action ? { action } : {}) })
  console.log(text)

  if (!currentLogFile) beginGameLog()
  appendFileSync(currentLogFile!, text, 'utf8')
}
