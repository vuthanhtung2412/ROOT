/**
 * Readers for the few game log entries the woodland moments are told by:
 * an action a seat took, a resolved event, and a victory point change.
 */

const ACTION_LOG_ENTRY_TYPE = 'action'
const EVENT_LOG_ENTRY_TYPE = 'event'
const VICTORY_POINTS_LOG_ENTRY_TYPE = 'vp'

export type LoggedAction = {
  actor: number
  actionType: string
  /** The action itself, for the fields of its type. */
  action: object
}

export type LoggedEvent = {
  eventType: string
  /** The event itself, for the fields of its type. */
  event: object
}

export type LoggedVictoryPoints = {
  actor: number
  delta: number
  reason: string
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

export function readLoggedAction(entry: unknown): LoggedAction | null {
  if (!isObject(entry)) return null
  if (Reflect.get(entry, 't') !== ACTION_LOG_ENTRY_TYPE) return null
  const actor: unknown = Reflect.get(entry, 'actor')
  const action: unknown = Reflect.get(entry, 'action')
  if (typeof actor !== 'number' || !isObject(action)) return null
  const actionType: unknown = Reflect.get(action, 'type')
  return typeof actionType === 'string' ? { actor, actionType, action } : null
}

export function readLoggedEvent(entry: unknown): LoggedEvent | null {
  if (!isObject(entry)) return null
  if (Reflect.get(entry, 't') !== EVENT_LOG_ENTRY_TYPE) return null
  const event: unknown = Reflect.get(entry, 'event')
  if (!isObject(event)) return null
  const eventType: unknown = Reflect.get(event, 'type')
  return typeof eventType === 'string' ? { eventType, event } : null
}

export function readLoggedVictoryPoints(
  entry: unknown,
): LoggedVictoryPoints | null {
  if (!isObject(entry)) return null
  if (Reflect.get(entry, 't') !== VICTORY_POINTS_LOG_ENTRY_TYPE) return null
  const actor: unknown = Reflect.get(entry, 'actor')
  const delta: unknown = Reflect.get(entry, 'delta')
  const reason: unknown = Reflect.get(entry, 'reason')
  if (
    typeof actor !== 'number' ||
    typeof delta !== 'number' ||
    typeof reason !== 'string'
  ) {
    return null
  }
  return { actor, delta, reason }
}

/** A number field of a logged action or event; null when absent. */
export function numberField(source: object, field: string): number | null {
  const value: unknown = Reflect.get(source, field)
  return typeof value === 'number' ? value : null
}
