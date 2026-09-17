import { api } from '../api/client.js'

export async function cmdJoin(playerId: string) {
  const result = await api.join(playerId)
  const { state } = result
  console.log(`joined ${playerId} seat=${state.players.at(-1)?.seat} status=${state.status}`)
}
