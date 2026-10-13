import type { AiPlayer, GameState } from '#api/client.ts'
import { findAiPlayer } from '#game/aiPlayerStore.ts'
import type {
  MenuFactionChoice,
  MenuLobbyHudState,
  MenuLobbySeat,
} from '#game/hudStore.ts'
import { MENU_FACTION_IDS } from '#game/menuPartySetup.ts'

/** An open lobby starts once this many players have picked a faction. */
const MIN_PLAYERS_TO_START = 2

type LobbyPlayer = GameState['players'][number]

/** Open lobby: every faction, marked with who picked it. */
function factionChoicesOf(
  state: GameState,
  localSeat: number | null,
): MenuFactionChoice[] {
  return MENU_FACTION_IDS.map((faction: string): MenuFactionChoice => {
    const owner: LobbyPlayer | undefined = state.players.find(
      (player: LobbyPlayer): boolean => player.faction === faction,
    )
    if (owner === undefined) return { faction, takenBy: null }
    return { faction, takenBy: owner.seat === localSeat ? 'you' : 'other' }
  })
}

/**
 * Lobby rows for the menu.
 * Open lobby: one row per player who picked a faction; the host starts with
 * two or more. Preset lobby: one row per decided seat; starts when full.
 * `aiPlayers`: the seats an AI player holds.
 */
export function buildMenuLobby(
  state: GameState,
  localSeat: number | null,
  isHost: boolean,
  aiPlayers: readonly AiPlayer[] = [],
): MenuLobbyHudState {
  const joinedCount: number = state.players.length
  if (state.openLobby === true) {
    return {
      seats: state.players.map(
        (player: LobbyPlayer): MenuLobbySeat => ({
          faction: player.faction,
          occupied: true,
          isLocalPlayer: player.seat === localSeat,
          aiModel: findAiPlayer(aiPlayers, player.seat)?.model ?? null,
        }),
      ),
      isHost,
      canStart: isHost && joinedCount >= MIN_PLAYERS_TO_START,
      factionChoices: factionChoicesOf(state, localSeat),
    }
  }
  return {
    seats: state.factions.map(
      (faction: string, seat: number): MenuLobbySeat => ({
        faction,
        occupied: seat < joinedCount,
        isLocalPlayer: seat === localSeat,
        aiModel: findAiPlayer(aiPlayers, seat)?.model ?? null,
      }),
    ),
    isHost,
    canStart: isHost && joinedCount === state.factions.length,
    factionChoices: [],
  }
}
