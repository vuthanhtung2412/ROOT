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
    // A join id is that seat's secret: never hand it to another viewer.
    playerId: `${HIDDEN_PLAYER_ID_PREFIX}${String(player.seat)}`,
    hand: [],
  }
}

/** Placeholder shown instead of another seat's join id. */
export const HIDDEN_PLAYER_ID_PREFIX = 'hidden-seat-'
