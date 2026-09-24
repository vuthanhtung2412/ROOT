import { formatGameView, type GameState } from '@root/lib'
import { api } from '#api/client.js'

function isLibGameState(value: unknown): value is GameState {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(Reflect.get(value, 'players')) &&
    Array.isArray(Reflect.get(value, 'clearings'))
  )
}

export async function cmdShow(): Promise<void> {
  const { state, historyLength } = await api.getGame()
  if (!isLibGameState(state)) {
    throw new Error('unexpected game payload')
  }
  console.log(formatGameView(state, { historyLength }))
}
