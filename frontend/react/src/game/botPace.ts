/**
 * Bot pace: the seconds the solo game waits after each bot action, so the
 * player can follow the bot's turn. Kept per browser.
 */
import type { PlayerIdentityStorage } from '#game/playerIdentity.ts'

/** Slowest first: the pace button steps through them in this order. */
export const BOT_STEP_DELAY_SECONDS_CHOICES: readonly number[] = [5, 2, 1]
export const DEFAULT_BOT_STEP_DELAY_SECONDS = 5
const BOT_STEP_DELAY_STORAGE_KEY = 'root.react.botStepDelaySeconds'
const MILLISECONDS_PER_SECOND = 1000

type BotPaceListener = () => void

const listeners: Set<BotPaceListener> = new Set()
let storedDelaySeconds: number | null = null

function paceStorage(): PlayerIdentityStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isDelayChoice(seconds: number): boolean {
  return BOT_STEP_DELAY_SECONDS_CHOICES.includes(seconds)
}

function readStoredDelaySeconds(): number {
  try {
    const saved: number = Number(paceStorage()?.getItem(BOT_STEP_DELAY_STORAGE_KEY))
    return isDelayChoice(saved) ? saved : DEFAULT_BOT_STEP_DELAY_SECONDS
  } catch {
    return DEFAULT_BOT_STEP_DELAY_SECONDS
  }
}

/**
 * Online co-op: the server paces the bots at the host's pace. The host may
 * ask for another; guests see it locked.
 */
export type OnlineBotPace = {
  delaySeconds: number
  canChange: boolean
  requestDelaySeconds: (seconds: number) => void
}

let onlineBotPace: OnlineBotPace | null = null

/** Online co-op game on screen: the pace the server pushed. Null: solo / none. */
export function setOnlineBotPace(pace: OnlineBotPace | null): void {
  const isSame: boolean =
    pace !== null &&
    onlineBotPace !== null &&
    pace.delaySeconds === onlineBotPace.delaySeconds &&
    pace.canChange === onlineBotPace.canChange
  onlineBotPace = pace
  if (isSame) return
  for (const listener of listeners) listener()
}

export function getOnlineBotPace(): OnlineBotPace | null {
  return onlineBotPace
}

/** The pace button shows at all: a solo game, or an online co-op game. */
export function isBotPaceShown(isSoloGame: boolean): boolean {
  return isSoloGame || onlineBotPace !== null
}

/** Online guests see the host's pace but cannot change it. */
export function isBotPaceLocked(): boolean {
  return onlineBotPace !== null && !onlineBotPace.canChange
}

export function botStepDelaySeconds(): number {
  if (onlineBotPace !== null) return onlineBotPace.delaySeconds
  storedDelaySeconds ??= readStoredDelaySeconds()
  return storedDelaySeconds
}

export function setBotStepDelaySeconds(seconds: number): void {
  if (!isDelayChoice(seconds)) return
  if (onlineBotPace !== null) {
    // The server holds the pace: its push brings the new one back.
    if (onlineBotPace.canChange) onlineBotPace.requestDelaySeconds(seconds)
    return
  }
  storedDelaySeconds = seconds
  try {
    paceStorage()?.setItem(BOT_STEP_DELAY_STORAGE_KEY, String(seconds))
  } catch {
    // Storage blocked: the pace lasts for this page only.
  }
  for (const listener of listeners) listener()
}

/** The next faster pace, back to the slowest after the fastest. */
export function nextBotStepDelaySeconds(seconds: number): number {
  const nextIndex: number =
    (BOT_STEP_DELAY_SECONDS_CHOICES.indexOf(seconds) + 1) % BOT_STEP_DELAY_SECONDS_CHOICES.length
  return BOT_STEP_DELAY_SECONDS_CHOICES[nextIndex] ?? DEFAULT_BOT_STEP_DELAY_SECONDS
}

export function subscribeBotPace(listener: BotPaceListener): () => void {
  listeners.add(listener)
  return (): void => {
    listeners.delete(listener)
  }
}

/** Waits the current pace; a pace picked during the wait applies at once. */
export function waitBotStepDelay(): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    const startedAt: number = Date.now()
    let timer: ReturnType<typeof setTimeout> | null = null
    const finish = (): void => {
      unsubscribe()
      resolve()
    }
    const schedule = (): void => {
      if (timer !== null) clearTimeout(timer)
      const elapsedMilliseconds: number = Date.now() - startedAt
      const delayMilliseconds: number = botStepDelaySeconds() * MILLISECONDS_PER_SECOND
      timer = setTimeout(finish, Math.max(0, delayMilliseconds - elapsedMilliseconds))
    }
    const unsubscribe: () => void = subscribeBotPace(schedule)
    schedule()
  })
}
