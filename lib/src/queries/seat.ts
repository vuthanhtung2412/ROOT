import type { FactionId, Seat } from '../pieces/types.js'
import type { GameState, PlayerState } from '../state/types.js'

/** Faction assigned to a seat at game start. */
export function factionOf(state: GameState, seat: Seat): FactionId {
  const player = state.players.find((p) => p.seat === seat)
  if (!player) throw new Error(`no player for seat ${seat}`)
  return player.faction
}

export function playerOf(state: GameState, seat: Seat): PlayerState {
  const player = state.players.find((p) => p.seat === seat)
  if (!player) throw new Error(`no player for seat ${seat}`)
  return player
}

export function isEyrieSeat(state: GameState, seat: Seat): boolean {
  return factionOf(state, seat) === 'eyrie'
}
