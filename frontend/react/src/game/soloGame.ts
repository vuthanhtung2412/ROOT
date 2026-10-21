/**
 * Solo mode: one player against the Rootbotics bots, played in the browser
 * on the in-memory game (no server).
 */
import { createLocalGame, type LocalGame } from '#api/localGameApi.ts'
import { GameSession } from '#game/GameSession.ts'
import type { MenuFactionId } from '#game/menuPartySetup.ts'
import type { PlayerIdentityStorage } from '#game/playerIdentity.ts'
import type { BotSettingsByFaction } from '@root/lib/bot-settings'

const SOLO_GAME_OPEN_STORAGE_KEY = 'root.react.soloGameOpen'
const OPEN_VALUE = 'true'
/** No server behind the local game: no base URL for its requests. */
const LOCAL_API_BASE_URL = ''

let localGame: LocalGame | null = null
let soloSession: GameSession | null = null

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

function defaultStorage(): PlayerIdentityStorage | null {
  // sessionStorage = per browser tab, survives a page reload.
  if (typeof sessionStorage === 'undefined') {
    return null
  }
  return sessionStorage
}

/** New solo game: the player's faction first, then the bots seat themselves. */
export async function startSoloGame(solo: {
  factions: MenuFactionId[]
  botSettings: BotSettingsByFaction
}): Promise<boolean> {
  const session: GameSession = soloGameSession()
  const started: boolean = await session.startLocalParty(solo.factions, solo.botSettings)
  if (started) {
    defaultStorage()?.setItem(SOLO_GAME_OPEN_STORAGE_KEY, OPEN_VALUE)
  }
  return started
}

/** Page reload inside a solo game: the saved game back on the session. */
export async function resumeSoloGame(): Promise<boolean> {
  const storage: PlayerIdentityStorage | null = defaultStorage()
  if (storage?.getItem(SOLO_GAME_OPEN_STORAGE_KEY) !== OPEN_VALUE) {
    return false
  }
  if (!soloLocalGame().restoreSavedGame()) {
    storage.removeItem(SOLO_GAME_OPEN_STORAGE_KEY)
    return false
  }
  const session: GameSession = soloGameSession()
  await session.continueQaLoadedGame()
  const { error, state } = session.getSnapshot()
  return (
    error === null && (state?.status === 'playing' || state?.status === 'setup')
  )
}

/** A solo game is on screen: its bots play at the pace the player picks. */
export function isSoloGameOpen(): boolean {
  return defaultStorage()?.getItem(SOLO_GAME_OPEN_STORAGE_KEY) === OPEN_VALUE
}

/** Back on the menu: a reload stays there. */
export function clearSoloGameOpen(): void {
  defaultStorage()?.removeItem(SOLO_GAME_OPEN_STORAGE_KEY)
}
