import { formatGameView, type GameState } from '@root/lib'
import { api } from '../api/client.js'

export async function cmdShow() {
  const { state, historyLength } = await api.get()
  console.log(formatGameView(state as GameState, { historyLength }))
}
