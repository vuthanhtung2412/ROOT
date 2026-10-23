import { store, type GameRoom } from '#store/GameStore.js'

/** Who calls a game route: the room they reach, their join id, the view they ask for. */
export type GameCaller = {
  room: GameRoom
  playerId: string | undefined
  view?: string | undefined
}

/** The room a caller's requests reach: the hotseat slot for now. */
export function resolveRoom(_playerId: string | undefined): GameRoom {
  return store
}

export function resolveGameCaller(
  playerId: string | undefined,
  view?: string,
): GameCaller {
  return { room: resolveRoom(playerId), playerId, view }
}
