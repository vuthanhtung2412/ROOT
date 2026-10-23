import { store, type GameRoom } from '#store/GameStore.js'
import { roomRegistry } from '#store/roomRegistry.js'

/** Who calls a game route: the room they reach, their join id, the view they ask for. */
export type GameCaller = {
  room: GameRoom
  playerId: string | undefined
  view?: string | undefined
}

/** A player in an online room reaches that room; anyone else the hotseat slot. */
export function resolveRoom(playerId: string | undefined): GameRoom {
  if (playerId === undefined) {
    return store
  }
  return roomRegistry.roomOfPlayer(playerId) ?? store
}

export function resolveGameCaller(
  playerId: string | undefined,
  view?: string,
): GameCaller {
  return { room: resolveRoom(playerId), playerId, view }
}
