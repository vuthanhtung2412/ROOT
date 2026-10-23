import type { PlayerState } from '@root/lib'
import type {
  AiPlayerSeat,
  AiPlayerStatus,
  GameRoom,
} from '#store/GameStore.js'

/** An AI seat as any viewer may see it. Its join id stays on the server. */
export type AiPlayerView = {
  seat: number
  /** `<provider>:<modelId>`. */
  model: string
  status: AiPlayerStatus
}

/** AI seats of the room's game, by seat. */
export function listAiPlayerViews(room: GameRoom): AiPlayerView[] {
  const players: readonly PlayerState[] = room.game?.state.players ?? []
  const views: AiPlayerView[] = []
  for (const player of players) {
    const aiSeat = room.aiPlayers.find(
      (candidate: AiPlayerSeat): boolean =>
        candidate.playerId === player.playerId,
    )
    if (aiSeat !== undefined) {
      views.push({
        seat: player.seat,
        model: aiSeat.model,
        status: aiSeat.status,
      })
    }
  }
  return views
}
