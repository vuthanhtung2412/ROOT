import { api } from '../api/client.js'

export async function cmdStart() {
  const { state } = await api.start()
  console.log(`started turn=${state.turn} seat=${state.currentSeat} phase=${state.phase}/${state.step}`)
}
