import type { GameState, PlayerState } from '@root/lib'

/**
 * Seat-scoped view for game WS: keep viewer's hand, strip other seats' cards.
 * Does not mutate `state`.
 */
export function redactStateForViewer(
  state: GameState,
  viewerPlayerId: string,
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      redactPlayerForViewer(player, viewerPlayerId),
    ),
  }
}

function redactPlayerForViewer(
  player: PlayerState,
  viewerPlayerId: string,
): PlayerState {
  if (player.playerId === viewerPlayerId) {
    return player
  }
  return {
    ...player,
    hand: [],
  }
}
