import { redactLegalActionsForViewer } from '#view/redactLegalActionsForViewer.js'
import { redactStateForViewer } from '#view/redactStateForViewer.js'
import { store } from '#store/GameStore.js'

export type GamePushPayload = {
  state: unknown | null
  historyLength: number
  legalActions: unknown[]
  log: unknown[]
}

export type GameHubClient = {
  playerId: string
  send: (data: string) => void
  isOpen: () => boolean
}

const EMPTY_GAME_PUSH: GamePushPayload = {
  state: null,
  historyLength: 0,
  legalActions: [],
  log: [],
}

/** Build the WS push payload for one viewer (opponent hands redacted). */
export function snapshotGamePushForViewer(playerId: string): GamePushPayload {
  const game = store.game
  if (game === null) {
    return EMPTY_GAME_PUSH
  }
  return {
    state: redactStateForViewer(game.state, playerId),
    historyLength: game.history.length,
    legalActions: redactLegalActionsForViewer(
      game.legalActions(),
      game.state,
      playerId,
    ),
    log: game.log,
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
  ): void {
    for (const [playerId, clients] of this.clientsByPlayerId) {
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

/** Push current slot to every connected viewer with per-seat hand redaction. */
export function broadcastCurrentGame(): void {
  gameHub.broadcastToViewers((playerId) => snapshotGamePushForViewer(playerId))
}
