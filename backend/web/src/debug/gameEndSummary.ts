import type { GameState, Seat } from '@root/lib'

export type PlayerVictoryPointsLine = {
  seat: Seat
  playerId: string
  faction: string
  victoryPoints: number
}

export type GameEndSummary = {
  winnerSeat: Seat | null
  winnerPlayerId: string | null
  winnerFaction: string | null
  victoryPointsByPlayer: PlayerVictoryPointsLine[]
  turns: number
  durationMilliseconds: number
}

const MILLISECONDS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60

export function formatDurationLabel(durationMilliseconds: number): string {
  const totalSeconds = Math.max(
    0,
    Math.floor(durationMilliseconds / MILLISECONDS_PER_SECOND),
  )
  const hours = Math.floor(
    totalSeconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR),
  )
  const minutes = Math.floor(
    (totalSeconds % (SECONDS_PER_MINUTE * MINUTES_PER_HOUR)) /
      SECONDS_PER_MINUTE,
  )
  const seconds = totalSeconds % SECONDS_PER_MINUTE
  if (hours > 0) {
    return `${String(hours)}h ${String(minutes)}m ${String(seconds)}s`
  }
  if (minutes > 0) {
    return `${String(minutes)}m ${String(seconds)}s`
  }
  return `${String(seconds)}s`
}

export type BuildGameEndSummaryInput = {
  state: GameState
  startedAtIso: string
  endedAtIso: string
}

export function buildGameEndSummary(
  input: BuildGameEndSummaryInput,
): GameEndSummary {
  const startedAtMilliseconds = Date.parse(input.startedAtIso)
  const endedAtMilliseconds = Date.parse(input.endedAtIso)
  const durationMilliseconds =
    Number.isFinite(startedAtMilliseconds) &&
    Number.isFinite(endedAtMilliseconds)
      ? Math.max(0, endedAtMilliseconds - startedAtMilliseconds)
      : 0

  const winnerSeat =
    input.state.winner !== undefined ? input.state.winner : null
  const winnerPlayer =
    winnerSeat === null
      ? null
      : (input.state.players.find((player) => player.seat === winnerSeat) ??
        null)

  return {
    winnerSeat,
    winnerPlayerId: winnerPlayer?.playerId ?? null,
    winnerFaction: winnerPlayer?.faction ?? null,
    victoryPointsByPlayer: input.state.players.map((player) => ({
      seat: player.seat,
      playerId: player.playerId,
      faction: player.faction,
      victoryPoints: player.vp,
    })),
    turns: input.state.turn,
    durationMilliseconds,
  }
}

/** One console / game.md block for a finished game. */
export function formatGameEndSummary(summary: GameEndSummary): string {
  const winnerLabel =
    summary.winnerSeat === null
      ? 'none'
      : `seat${String(summary.winnerSeat)} ${summary.winnerFaction ?? '?'} (${summary.winnerPlayerId ?? '?'})`
  const victoryPointsLines = summary.victoryPointsByPlayer
    .map(
      (line) =>
        `  seat${String(line.seat)} ${line.faction} ${line.playerId}: ${String(line.victoryPoints)} VP`,
    )
    .join('\n')
  return [
    'GAME END',
    `winner: ${winnerLabel}`,
    'VP:',
    victoryPointsLines,
    `turns: ${String(summary.turns)}`,
    `duration: ${formatDurationLabel(summary.durationMilliseconds)}`,
  ].join('\n')
}
