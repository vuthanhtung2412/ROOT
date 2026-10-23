import { artFactionOf, isBotFaction } from '@root/lib/bot-factions'
import type { AiPlayer, GameState, PlayMode } from '#api/client.ts'
import { findAiPlayer } from '#game/aiPlayerStore.ts'
import type {
  MenuFactionChoice,
  MenuLobbyTableState,
  MenuLobbySeat,
} from '#game/hudStore.ts'
import { MENU_BOT_FACTION_IDS, MENU_FACTION_IDS } from '#game/menuPartySetup.ts'

/** An open lobby starts once this many players have picked a faction. */
const MIN_PLAYERS_TO_START = 2
/** Rule: Rootbotics 3.5.1 — co-op needs a team of humans and a bot to face. */
const MIN_COOPERATIVE_HUMANS = 2
const MIN_COOPERATIVE_BOTS = 1
/** Seats of an open lobby (players pick their faction): the table size. */
const OPEN_LOBBY_SEAT_COUNT = 4
const NOT_ENOUGH_PLAYERS_REASON = 'Needs at least two players'
const SEATS_NOT_FILLED_REASON = 'Waits for every seat'
const NOT_ENOUGH_HUMANS_REASON = 'Needs 2 human players'
const NO_BOT_REASON = 'Needs a bot'

/** What the mode switch and the guest notice call each play mode. */
export const PLAY_MODE_LABELS: Readonly<Record<PlayMode, string>> = {
  freeForAll: 'Free-for-all',
  cooperative: 'Co-op vs bots',
}

type LobbyPlayer = GameState['players'][number]

function playModeOf(state: GameState): PlayMode {
  return state.cooperative === true ? 'cooperative' : 'freeForAll'
}

/**
 * Who holds the pieces of `faction`: its player, or the bot that plays them
 * (Rootbotics 3.2: Mechanical Marquise → Marquise, Electric Eyrie → Eyrie).
 */
function choiceOf(
  state: GameState,
  faction: string,
  localSeat: number | null,
): MenuFactionChoice {
  const owner: LobbyPlayer | undefined = state.players.find(
    (player: LobbyPlayer): boolean => artFactionOf(player.faction) === artFactionOf(faction),
  )
  if (owner === undefined) return { faction, takenBy: null }
  return { faction, takenBy: owner.seat === localSeat && owner.faction === faction ? 'you' : 'other' }
}

/** Open lobby: every faction, marked with who picked it. */
function factionChoicesOf(
  state: GameState,
  localSeat: number | null,
): MenuFactionChoice[] {
  return MENU_FACTION_IDS.map(
    (faction: string): MenuFactionChoice => choiceOf(state, faction, localSeat),
  )
}

/** Co-op: the bots, taken once seated or when a human holds their pieces. */
function botChoicesOf(state: GameState): MenuFactionChoice[] {
  return MENU_BOT_FACTION_IDS.map(
    (faction: string): MenuFactionChoice => choiceOf(state, faction, null),
  )
}

function startBlockedReasonOf(state: GameState): string | null {
  if (playModeOf(state) === 'freeForAll') {
    return state.players.length >= MIN_PLAYERS_TO_START ? null : NOT_ENOUGH_PLAYERS_REASON
  }
  const botCount: number = state.players.filter(
    (player: LobbyPlayer): boolean => isBotFaction(player.faction),
  ).length
  if (state.players.length - botCount < MIN_COOPERATIVE_HUMANS) return NOT_ENOUGH_HUMANS_REASON
  if (botCount < MIN_COOPERATIVE_BOTS) return NO_BOT_REASON
  return null
}

/**
 * Lobby rows for the menu.
 * Open lobby: one row per player who picked a faction; the host starts with
 * two or more (co-op: two humans and a bot). Preset lobby: one row per
 * decided seat; starts when full. `aiPlayers`: the seats an AI player holds.
 */
export function buildMenuLobby(
  state: GameState,
  localSeat: number | null,
  isHost: boolean,
  aiPlayers: readonly AiPlayer[] = [],
): MenuLobbyTableState {
  const joinedCount: number = state.players.length
  const tableSettings = {
    playMode: playModeOf(state),
    botSettings: state.botSettings ?? {},
  }
  if (state.openLobby === true) {
    const startBlockedReason: string | null = startBlockedReasonOf(state)
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
      canStart: isHost && startBlockedReason === null,
      factionChoices: factionChoicesOf(state, localSeat),
      openSeatCount: Math.max(OPEN_LOBBY_SEAT_COUNT - joinedCount, 0),
      startBlockedReason,
      botChoices: botChoicesOf(state),
      ...tableSettings,
    }
  }
  const isFull: boolean = joinedCount === state.factions.length
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
    canStart: isHost && isFull,
    factionChoices: [],
    openSeatCount: 0,
    startBlockedReason: isFull ? null : SEATS_NOT_FILLED_REASON,
    botChoices: [],
    ...tableSettings,
  }
}
