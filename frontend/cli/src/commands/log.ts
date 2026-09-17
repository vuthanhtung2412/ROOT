import { formatTurnLog, type GameState, type LogEntry } from '@root/lib'
import { api } from '../api/client.js'

export async function cmdLog() {
  const [{ state }, { log }] = await Promise.all([api.get(), api.log()])
  console.log(formatTurnLog(log as LogEntry[], state as GameState))
}
