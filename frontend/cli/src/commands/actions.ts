import { api } from '#api/client.js'

export async function cmdActions(): Promise<void> {
  const { state } = await api.getGame()
  const { actions } = await api.legalActions()
  const current = state.players.find((p) => p.seat === state.currentSeat)
  const who = current ? `${current.faction}/${current.playerId}` : 'nobody'
  console.log(`${who} phase=${state.phase}/${state.step}`)
  console.log(JSON.stringify(actions, null, 2))
}
