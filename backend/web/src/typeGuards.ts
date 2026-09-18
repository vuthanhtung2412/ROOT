import type { Action, FactionId, GameSnapshot } from '@root/lib'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const FACTION_IDS: ReadonlySet<string> = new Set([
  'marquise',
  'eyrie',
  'alliance',
  'vagabond',
])

export function isFactionId(value: unknown): value is FactionId {
  return typeof value === 'string' && FACTION_IDS.has(value)
}

export function isFactionIdArray(value: unknown): value is FactionId[] {
  return Array.isArray(value) && value.every(isFactionId)
}

/** Zod ActionSchema is loose; narrow to engine Action after request validation. */
export function isAction(value: unknown): value is Action {
  if (!isRecord(value)) return false
  return typeof value.type === 'string'
}

/** Zod GameSnapshotSchema is loose; narrow to engine GameSnapshot after validation. */
export function isGameSnapshot(value: unknown): value is GameSnapshot {
  if (!isRecord(value)) return false
  if (!isRecord(value.state)) return false
  if (!Array.isArray(value.history) || !value.history.every(isAction)) return false
  if (!Array.isArray(value.log)) return false
  if (!isRecord(value.rng)) return false
  if (typeof value.rng.seed !== 'number') return false
  if (typeof value.rng.cursor !== 'number') return false
  return true
}
