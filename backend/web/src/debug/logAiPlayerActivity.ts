import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AiPlayerActivity } from '#aiPlayer/AiPlayerActivityFeed.js'
import { gameLogDirectory } from '#debug/logGame.js'
import { store, type GameRoom } from '#store/GameStore.js'
import { roomRegistry } from '#store/roomRegistry.js'

export const AI_PLAYER_ACTIVITY_LOG_FILE_NAME = 'ai-players.jsonl'

/** The game the activity belongs to: null once its room has no game. */
function gameIdOfActivity(activity: AiPlayerActivity): string | null {
  const room: GameRoom | null =
    activity.roomCode === null ? store : roomRegistry.findRoom(activity.roomCode)
  return room?.game?.state.id ?? null
}

/**
 * Everything the AI players are told, say and do, one JSON line per activity
 * with its text whole: `logs/<stamp>/ai-players.jsonl`, beside `game.md`.
 */
export function logAiPlayerActivity(activity: AiPlayerActivity): void {
  const gameId: string | null = gameIdOfActivity(activity)
  if (gameId === null) {
    return
  }
  try {
    appendFileSync(
      join(gameLogDirectory(gameId), AI_PLAYER_ACTIVITY_LOG_FILE_NAME),
      `${JSON.stringify(activity)}\n`,
      'utf8',
    )
  } catch (error: unknown) {
    // A full disk must not stop the AI player whose activity is being logged.
    const reason: string = error instanceof Error ? error.message : String(error)
    console.error(`AI player activity not logged: ${reason}`)
  }
}
