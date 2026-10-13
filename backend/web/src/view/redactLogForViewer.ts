import type { Action, FactionId, GameState, LogEntry } from '@root/lib'
import { HIDDEN_CARD_DEFINITION_ID } from '#view/redactStateForViewer.js'

/** Log entry as sent to a viewer: join and expel entries carry no join id. */
export type ViewerLogEntry =
  | Exclude<LogEntry, { t: 'join' } | { t: 'expel' }>
  | { t: 'join'; faction: FactionId }
  | { t: 'expel'; faction: FactionId }

function seatForPlayerId(state: GameState, playerId: string): number | null {
  const player = state.players.find(
    (candidate) => candidate.playerId === playerId,
  )
  return player === undefined ? null : player.seat
}

/**
 * Card moves between hidden zones (hand → hand, hand → face-down supporters)
 * or answers a pending event from hand: other seats see that the action
 * happened, not which card.
 */
function hideSecretCard(action: Action): Action {
  switch (action.type) {
    case 'mobilize':
      return {
        ...action,
        cardIds: action.cardIds.map((): string => HIDDEN_CARD_DEFINITION_ID),
      }
    case 'aid':
      return { ...action, cardId: HIDDEN_CARD_DEFINITION_ID }
    case 'resolveEvent':
      return action.cardId === undefined
        ? action
        : { ...action, cardId: HIDDEN_CARD_DEFINITION_ID }
    default:
      return action
  }
}

/**
 * Seat-scoped game log. Join and expel entries lose the join id (a seat's secret) and
 * other seats' hidden-card actions lose the card id. Does not mutate `log`.
 */
export function redactLogForViewer(
  log: readonly LogEntry[],
  state: GameState,
  viewerPlayerId: string,
): ViewerLogEntry[] {
  const viewerSeat = seatForPlayerId(state, viewerPlayerId)
  return log.map((entry: LogEntry): ViewerLogEntry => {
    if (entry.t === 'join') {
      return { t: 'join', faction: entry.faction }
    }
    if (entry.t === 'expel') {
      return { t: 'expel', faction: entry.faction }
    }
    if (entry.t === 'action' && entry.actor !== viewerSeat) {
      return { ...entry, action: hideSecretCard(entry.action) }
    }
    return entry
  })
}
