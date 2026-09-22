import { formatTurnLog, type GameState, type LogEntry } from '@root/lib'
import { api } from '#api/client.js'

function isLogEntryArray(value: unknown): value is LogEntry[] {
  return Array.isArray(value)
}

function isLibGameState(value: unknown): value is GameState {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(Reflect.get(value, 'players')) &&
    Array.isArray(Reflect.get(value, 'clearings'))
  )
}

export async function cmdLog(): Promise<void> {
  const [{ state }, { log }] = await Promise.all([api.get(), api.log()])
  if (!isLibGameState(state) || !isLogEntryArray(log)) {
    throw new Error('unexpected game payload')
  }
  console.log(formatTurnLog(log, state))
}
