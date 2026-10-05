import type { GameSession } from '#game/GameSession.ts'
import type { PlayerIdentityStorage } from '#game/playerIdentity.ts'

const STORAGE_KEY = 'root.react.hotseatGameOpen'
const OPEN_VALUE = 'true'
const RELOAD_MAX_ATTEMPTS = 5
const RELOAD_RETRY_DELAY_MILLISECONDS = 500

/**
 * After a page reload: read the server slot as it is (no snapshot autoload,
 * so progress is kept). The API may still be restarting after the same code
 * edit, so retry. True when there is a game to re-enter.
 */
export async function reloadHotseatSlot(
  session: GameSession,
  retryDelayMilliseconds: number = RELOAD_RETRY_DELAY_MILLISECONDS,
): Promise<boolean> {
  for (let attempt = 1; attempt <= RELOAD_MAX_ATTEMPTS; attempt += 1) {
    await session.continueQaLoadedGame()
    if (session.getSnapshot().error === null) {
      break
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, retryDelayMilliseconds)
    })
  }
  const { error, state } = session.getSnapshot()
  return (
    error === null && (state?.status === 'playing' || state?.status === 'setup')
  )
}

function defaultStorage(): PlayerIdentityStorage | null {
  // sessionStorage = per browser tab, survives a page reload (Vite code edit).
  if (typeof sessionStorage === 'undefined') {
    return null
  }
  return sessionStorage
}

/** Remember this tab is inside a hotseat / QA game, so a reload re-enters it. */
export function markHotseatGameOpen(
  storage: PlayerIdentityStorage | null = defaultStorage(),
): void {
  storage?.setItem(STORAGE_KEY, OPEN_VALUE)
}

/** Back on the menu (End game / leave): a reload stays on the menu. */
export function clearHotseatGameOpen(
  storage: PlayerIdentityStorage | null = defaultStorage(),
): void {
  storage?.removeItem(STORAGE_KEY)
}

export function isHotseatGameOpen(
  storage: PlayerIdentityStorage | null = defaultStorage(),
): boolean {
  return storage?.getItem(STORAGE_KEY) === OPEN_VALUE
}
