import { isBotSeat, isHumanPlayer } from '#factions/bots/botFactions.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import type { GameState, PlayerState, Team } from '#state/types.js'

/** Rule: Victory — the score a player reaches to win. */
export const WINNING_VICTORY_POINTS = 30

function hasReachedWinningScore(player: PlayerState): boolean {
  return player.vp >= WINNING_VICTORY_POINTS
}

function teamOfPlayer(player: PlayerState): Team {
  return isHumanPlayer(player) ? 'humans' : 'bots'
}

/**
 * Rule: Rootbotics 3.5.1 — the humans win when every human has 30 VP before
 * any bot does; any bot at 30 VP wins for the bots. Both at once (same
 * action): the team of the player whose turn it is wins, like the base tie.
 */
function winningTeamOf(state: GameState): Team | null {
  const humans: PlayerState[] = state.players.filter(isHumanPlayer)
  const bots: PlayerState[] = state.players.filter(
    (player: PlayerState): boolean => !isHumanPlayer(player),
  )
  const humansWin: boolean = humans.length > 0 && humans.every(hasReachedWinningScore)
  const botsWin: boolean = bots.some(hasReachedWinningScore)
  if (humansWin && botsWin) {
    return isBotSeat(state, state.currentSeat) ? 'bots' : 'humans'
  }
  if (humansWin) return 'humans'
  if (botsWin) return 'bots'
  return null
}

/** Cooperative game: ends it when a team has won. `winner` is the team seat whose turn it is, else its first seat. */
export function checkCooperativeWin(state: GameState): LogEntry[] {
  const team: Team | null = winningTeamOf(state)
  if (team === null) return []
  const teamSeats: Seat[] = state.players
    .filter((player: PlayerState): boolean => teamOfPlayer(player) === team)
    .map((player: PlayerState): Seat => player.seat)
  const winner: Seat = teamSeats.includes(state.currentSeat)
    ? state.currentSeat
    : teamSeats[0]!
  state.winner = winner
  state.coWinners = teamSeats.filter((seat: Seat): boolean => seat !== winner)
  state.winningTeam = team
  state.status = 'finished'
  return [{ t: 'win', winner }]
}
