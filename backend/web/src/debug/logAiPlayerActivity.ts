import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AiPlayerActivity } from '#aiPlayer/AiPlayerActivityFeed.js'
import { currentGameLogDirectory } from '#debug/logGame.js'

export const AI_PLAYER_ACTIVITY_LOG_FILE_NAME = 'ai-players.jsonl'

/**
 * Everything the AI players are told, say and do, one JSON line per activity
 * with its text whole: `logs/<stamp>/ai-players.jsonl`, beside `game.md`.
 */
export function logAiPlayerActivity(activity: AiPlayerActivity): void {
  try {
    appendFileSync(
      join(currentGameLogDirectory(), AI_PLAYER_ACTIVITY_LOG_FILE_NAME),
      `${JSON.stringify(activity)}\n`,
      'utf8',
    )
  } catch (error: unknown) {
    // A full disk must not stop the AI player whose activity is being logged.
    const reason: string = error instanceof Error ? error.message : String(error)
    console.error(`AI player activity not logged: ${reason}`)
  }
}
