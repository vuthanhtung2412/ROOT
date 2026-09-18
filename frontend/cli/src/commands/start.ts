import { api } from '../api/client.js'

export async function cmdStart() {
  const { state } = await api.start()
  const current = state.players.find((p) => p.seat === state.currentSeat)
  const who = current ? `${current.faction}/${current.playerId}` : 'nobody'
  console.log(`started turn=${state.turn} ${who} phase=${state.phase}/${state.step}`)
}
