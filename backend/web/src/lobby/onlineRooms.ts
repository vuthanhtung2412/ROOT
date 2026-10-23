import { HttpError } from '#middleware/errors.js'
import type { GameRoom } from '#store/GameStore.js'
import { roomRegistry } from '#store/roomRegistry.js'

/** An online room is found by its members' join ids: the caller must send one. */
export function requirePlayerId(playerId: string | undefined): string {
  if (playerId === undefined || playerId.trim() === '') {
    throw new HttpError(400, 'PLAYER_ID_REQUIRED', 'online rooms need the X-Player-Id header')
  }
  return playerId
}

/** A fresh online room with the caller in it. 409 while they are in another game. */
export function openOnlineRoom(playerId: string | undefined): GameRoom {
  const creatorPlayerId: string = requirePlayerId(playerId)
  roomRegistry.requireNoActiveRoom(creatorPlayerId)
  const room: GameRoom = roomRegistry.createRoom(creatorPlayerId)
  roomRegistry.addMember(room, creatorPlayerId)
  return room
}

/** True for an online room, false for the hotseat slot. */
export function isOnlineRoom(room: GameRoom): boolean {
  return room.roomCode !== null
}
