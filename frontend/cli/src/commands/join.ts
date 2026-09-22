import { api } from '#api/client.js'

export async function cmdJoin(playerId: string): Promise<void> {
  const result = await api.join(playerId)
  const { state } = result
  const joined = state.players.at(-1)
  const who = joined ? `${joined.faction}/${joined.playerId}` : playerId
  console.log(`joined ${who} status=${state.status}`)
}
