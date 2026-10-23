import { resetGameStore, type GameRoom } from '#store/GameStore.js'
import { roomRegistry } from '#store/roomRegistry.js'

/** Empty hotseat slot and no online room: each test starts from a fresh server. */
export function resetAllRooms(): void {
  for (const room of roomRegistry.rooms()) {
    // A null game also stops the room's AI seats and bots.
    room.game = null
    roomRegistry.removeRoom(room)
  }
  resetGameStore()
}

/** The one online room the test opened. */
export function onlyOnlineRoom(): GameRoom {
  const [room, ...otherRooms] = roomRegistry.rooms()
  if (room === undefined || otherRooms.length > 0) {
    throw new Error(`expected one online room, found ${roomRegistry.rooms().length}`)
  }
  return room
}

/** Guests: be in the test's online room, as entering it by code would. */
export function enterOnlyOnlineRoom(...playerIds: readonly string[]): void {
  const room: GameRoom = onlyOnlineRoom()
  for (const playerId of playerIds) {
    roomRegistry.addMember(room, playerId)
  }
}
