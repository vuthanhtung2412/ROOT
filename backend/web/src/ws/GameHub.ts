import { redactLegalActionsForViewer } from '#view/redactLegalActionsForViewer.js'
import { redactLogForViewer } from '#view/redactLogForViewer.js'
import { redactStateForViewer } from '#view/redactStateForViewer.js'
import { resolveRoom } from '#middleware/roomResolver.js'
import {
  DEFAULT_BOT_STEP_DELAY_SECONDS,
  HOTSEAT_ROOM_CODE,
  type BotStepDelaySeconds,
  type GameRoom,
} from '#store/GameStore.js'
import { listAiPlayerViews, type AiPlayerView } from '#view/aiPlayerView.js'

export type GamePushPayload = {
  /** The online room the viewer is in; null for the hotseat slot. */
  roomCode: string | null
  state: unknown | null
  historyLength: number
  legalActions: unknown[]
  log: unknown[]
  /** Seats played by an LLM: model and live status, never a join id. */
  aiPlayers: AiPlayerView[]
  /** Online games: seconds the server waits after each bot action. */
  botStepDelaySeconds: BotStepDelaySeconds
}

export type GameHubClient = {
  playerId: string
  send: (data: string) => void
  isOpen: () => boolean
}

const EMPTY_GAME_PUSH: GamePushPayload = {
  roomCode: HOTSEAT_ROOM_CODE,
  state: null,
  historyLength: 0,
  legalActions: [],
  log: [],
  aiPlayers: [],
  botStepDelaySeconds: DEFAULT_BOT_STEP_DELAY_SECONDS,
}

/** Build the WS push payload of the viewer's room (opponent hands redacted). */
export function snapshotGamePushForViewer(playerId: string): GamePushPayload {
  const room: GameRoom = resolveRoom(playerId)
  const game = room.game
  if (game === null) {
    return { ...EMPTY_GAME_PUSH, roomCode: room.roomCode }
  }
  return {
    roomCode: room.roomCode,
    state: redactStateForViewer(game.state, playerId),
    historyLength: game.history.length,
    legalActions: redactLegalActionsForViewer(
      game.legalActions(),
      game.state,
      playerId,
    ),
    log: redactLogForViewer(game.log, game.state, playerId),
    aiPlayers: listAiPlayerViews(room),
    botStepDelaySeconds: room.botStepDelaySeconds,
  }
}

/**
 * Tracks game WS clients by join `playerId`.
 * Broadcast sends JSON; dead sockets are dropped.
 */
export class GameHub {
  private readonly clientsByPlayerId = new Map<string, Set<GameHubClient>>()

  addClient(client: GameHubClient): void {
    const existing = this.clientsByPlayerId.get(client.playerId)
    if (existing !== undefined) {
      existing.add(client)
      return
    }
    this.clientsByPlayerId.set(client.playerId, new Set([client]))
  }

  removeClient(client: GameHubClient): void {
    const existing = this.clientsByPlayerId.get(client.playerId)
    if (existing === undefined) {
      return
    }
    existing.delete(client)
    if (existing.size === 0) {
      this.clientsByPlayerId.delete(client.playerId)
    }
  }

  clientCount(): number {
    let count = 0
    for (const clients of this.clientsByPlayerId.values()) {
      count += clients.size
    }
    return count
  }

  /** Same payload to every open client. */
  broadcastGame(payload: GamePushPayload): void {
    const message = JSON.stringify(payload)
    for (const [playerId, clients] of this.clientsByPlayerId) {
      for (const client of [...clients]) {
        if (!client.isOpen()) {
          clients.delete(client)
          continue
        }
        try {
          client.send(message)
        } catch {
          clients.delete(client)
        }
      }
      if (clients.size === 0) {
        this.clientsByPlayerId.delete(playerId)
      }
    }
  }

  /**
   * Per-viewer payloads (used once hand redaction lands).
   * Dead sockets dropped.
   */
  broadcastToViewers(
    buildPayload: (playerId: string) => GamePushPayload,
    isRecipient: (playerId: string) => boolean = (): boolean => true,
  ): void {
    for (const [playerId, clients] of this.clientsByPlayerId) {
      if (!isRecipient(playerId)) {
        continue
      }
      const message = JSON.stringify(buildPayload(playerId))
      for (const client of [...clients]) {
        if (!client.isOpen()) {
          clients.delete(client)
          continue
        }
        try {
          client.send(message)
        } catch {
          clients.delete(client)
        }
      }
      if (clients.size === 0) {
        this.clientsByPlayerId.delete(playerId)
      }
    }
  }
}

export const gameHub = new GameHub()

/** Push the room to its connected viewers only, with per-seat hand redaction. */
export function broadcastCurrentGame(room: GameRoom): void {
  gameHub.broadcastToViewers(
    (playerId: string): GamePushPayload => snapshotGamePushForViewer(playerId),
    (playerId: string): boolean => resolveRoom(playerId) === room,
  )
}
