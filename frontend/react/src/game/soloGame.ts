/**
 * Solo mode: one player against the Rootbotics bots, played in the browser
 * on the in-memory game (no server).
 */
import { createLocalGame, type LocalGame } from '#api/localGameApi.ts'
import { GameSession } from '#game/GameSession.ts'
import type { MenuFactionId } from '#game/menuPartySetup.ts'
import type { BotSettingsByFaction } from '@root/lib/bot-settings'

/** No server behind the local game: no base URL for its requests. */
const LOCAL_API_BASE_URL = ''

let localGame: LocalGame | null = null
let soloSession: GameSession | null = null
/** A solo game is on this page; the saved game itself outlives the browser. */
let soloGameOpen: boolean = false

function soloLocalGame(): LocalGame {
  localGame ??= createLocalGame()
  return localGame
}

/**
 * The solo game's own session: online play keeps its session, its join id
 * and its server connection untouched.
 */
export function soloGameSession(): GameSession {
  if (soloSession === null) {
    const game: LocalGame = soloLocalGame()
    soloSession = new GameSession({
      api: game.api,
      apiBaseUrl: LOCAL_API_BASE_URL,
      connectSocket: game.connectSocket,
      // No join id to keep: every seat of the solo game is on this screen.
      identityStorage: null,
    })
  }
  return soloSession
}

/** New solo game: the player's faction first, then the bots seat themselves. */
export async function startSoloGame(solo: {
  factions: MenuFactionId[]
  botSettings: BotSettingsByFaction
}): Promise<boolean> {
  const session: GameSession = soloGameSession()
  const started: boolean = await session.startLocalParty(solo.factions, solo.botSettings)
  soloGameOpen = started
  return started
}

/**
 * Page load with a solo game saved (reload, or the browser closed and opened
 * again): the game back on the session. A finished game is dropped.
 */
export async function resumeSoloGame(): Promise<boolean> {
  if (!soloLocalGame().restoreSavedGame()) {
    return false
  }
  const session: GameSession = soloGameSession()
  await session.continueQaLoadedGame()
  const { error, state } = session.getSnapshot()
  const isResumable: boolean =
    error === null && (state?.status === 'playing' || state?.status === 'setup')
  if (!isResumable) {
    await session.restart()
    return false
  }
  soloGameOpen = true
  return true
}

/** A solo game is on screen: its bots play at the pace the player picks. */
export function isSoloGameOpen(): boolean {
  return soloGameOpen
}

/** Back on the menu (End game deletes the saved game itself). */
export function clearSoloGameOpen(): void {
  soloGameOpen = false
}
