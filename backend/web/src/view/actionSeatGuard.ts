import type { ActionSpec, Game, GameState } from '@root/lib'

/** Request header carrying the caller's join `playerId` (secret per browser). */
export const PLAYER_ID_HEADER = 'X-Player-Id'

export function seatForPlayerId(
  state: GameState,
  playerId: string,
): number | null {
  const player = state.players.find(
    (candidate) => candidate.playerId === playerId,
  )
  return player === undefined ? null : player.seat
}

/**
 * Online mode: a player may send an action type only when a legal action of
 * that type names their seat as actor. Covers turn actions, pending events
 * answered by another seat (Field Hospitals, Outrage, ambush) and host start.
 */
export function mayPlayerSendAction(
  game: Game,
  playerId: string | undefined,
  actionType: string,
): boolean {
  if (playerId === undefined || playerId === '') {
    return false
  }
  const seat = seatForPlayerId(game.state, playerId)
  if (seat === null) {
    return false
  }
  return game
    .legalActions()
    .some(
      (spec: ActionSpec): boolean =>
        spec.actor === seat && spec.type === actionType,
    )
}
