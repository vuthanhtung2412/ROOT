import type { Game } from '@root/lib'
import { noGame } from '#middleware/errors.js'
import { PLAYER_VIEW } from '#schemas/common.js'
import { persistCurrentGame } from '#store/gamePersistence.js'
import type { GameRoom } from '#store/GameStore.js'
import { roomRegistry } from '#store/roomRegistry.js'
import { runtimeOf } from '#store/roomRuntime.js'
import { broadcastCurrentGame } from '#ws/GameHub.js'

export function requireGame(room: GameRoom): Game {
  if (!room.game) noGame()
  return room.game
}

/**
 * After every slot change: save to disk, push to connected viewers, then let
 * the AI seats play what is theirs to play.
 */
export function publishGameChange(room: GameRoom): void {
  persistCurrentGame()
  broadcastCurrentGame(room)
  runtimeOf(room).aiPlayerDriver.handleGameChanged()
  runtimeOf(room).botStepDriver.handleGameChanged()
}

/**
 * End an online room: its viewers get an empty slot, its AI seats and bots
 * stop, every member is free to create or enter another game.
 */
export function closeOnlineRoom(room: GameRoom): void {
  room.game = null
  room.aiPlayers = []
  publishGameChange(room)
  roomRegistry.removeRoom(room)
}

/**
 * Seat-scoped calls see and do only what the caller's seat may. Always in
 * online mode; in hotseat only when the caller asks for the player view.
 */
export function isSeatScoped(room: GameRoom, view: string | undefined): boolean {
  return room.mode === 'online' || view === PLAYER_VIEW
}
