/**
 * Solo mode: one player against both Rootbotics bots, played in the browser
 * on the in-memory game (no server).
 */
import { createLocalGame, type LocalGame } from '#api/localGameApi.ts'
import type { GameSession } from '#game/GameSession.ts'
import { soloPartyFactions, type SoloFactionId } from '#game/menuPartySetup.ts'
import type { PlayerIdentityStorage } from '#game/playerIdentity.ts'
import type { BotSettingsByFaction } from '@root/lib/bot-settings'

const SOLO_GAME_OPEN_STORAGE_KEY = 'root.react.soloGameOpen'
const OPEN_VALUE = 'true'
/** No server behind the local game: no base URL for its requests. */
const LOCAL_API_BASE_URL = ''

let localGame: LocalGame | null = null

function soloLocalGame(): LocalGame {
  localGame ??= createLocalGame()
  return localGame
}

function defaultStorage(): PlayerIdentityStorage | null {
  // sessionStorage = per browser tab, survives a page reload.
  if (typeof sessionStorage === 'undefined') {
    return null
  }
  return sessionStorage
}

function bindSessionToLocalGame(session: GameSession, game: LocalGame): void {
  session.rebindApi(game.api, LOCAL_API_BASE_URL, game.connectSocket)
}

/** New solo game: the player's faction, then both bots seat themselves. */
export async function startSoloGame(
  session: GameSession,
  solo: { faction: SoloFactionId; botSettings: BotSettingsByFaction },
): Promise<boolean> {
  bindSessionToLocalGame(session, soloLocalGame())
  const started: boolean = await session.startLocalParty(
    soloPartyFactions(solo.faction),
    solo.botSettings,
  )
  if (started) {
    defaultStorage()?.setItem(SOLO_GAME_OPEN_STORAGE_KEY, OPEN_VALUE)
  }
  return started
}

/** Page reload inside a solo game: the saved game back on the session. */
export async function resumeSoloGame(session: GameSession): Promise<boolean> {
  const storage: PlayerIdentityStorage | null = defaultStorage()
  if (storage?.getItem(SOLO_GAME_OPEN_STORAGE_KEY) !== OPEN_VALUE) {
    return false
  }
  const game: LocalGame = soloLocalGame()
  if (!game.restoreSavedGame()) {
    storage.removeItem(SOLO_GAME_OPEN_STORAGE_KEY)
    return false
  }
  bindSessionToLocalGame(session, game)
  await session.continueQaLoadedGame()
  const { error, state } = session.getSnapshot()
  return (
    error === null && (state?.status === 'playing' || state?.status === 'setup')
  )
}

/** Back on the menu: a reload stays there. */
export function clearSoloGameOpen(): void {
  defaultStorage()?.removeItem(SOLO_GAME_OPEN_STORAGE_KEY)
}
