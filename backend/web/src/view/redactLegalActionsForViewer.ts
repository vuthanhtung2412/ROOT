import type { ActionSpec, GameState } from '@root/lib'

/**
 * Seat-scoped legal actions for Phaser WS.
 * Drop other seats' specs so cardIds cannot leak opponent hands.
 */
export function redactLegalActionsForViewer(
  legalActions: readonly ActionSpec[],
  state: GameState,
  viewerPlayerId: string,
): ActionSpec[] {
  const viewerSeat = seatForPlayerId(state, viewerPlayerId)
  if (viewerSeat === null) {
    return []
  }
  return legalActions.filter((spec) => spec.actor === viewerSeat)
}

function seatForPlayerId(
  state: GameState,
  playerId: string,
): number | null {
  const player = state.players.find(
    (candidate) => candidate.playerId === playerId,
  )
  if (player === undefined) {
    return null
  }
  return player.seat
}
