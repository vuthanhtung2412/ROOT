import { api } from '../api/client.js'

export async function cmdActions() {
  const { state } = await api.get()
  const { actions } = await api.actions()
  const current = state.players.find((p) => p.seat === state.currentSeat)
  const who = current ? `${current.faction}/${current.playerId}` : 'nobody'
  console.log(`${who} phase=${state.phase}/${state.step}`)
  console.log(JSON.stringify(actions, null, 2))
}
