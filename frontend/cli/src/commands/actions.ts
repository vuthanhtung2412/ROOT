import { api } from '../api/client.js'

export async function cmdActions() {
  const { state } = await api.get()
  const { actions } = await api.actions()
  console.log(`seat=${state.currentSeat} phase=${state.phase}/${state.step}`)
  console.log(JSON.stringify(actions, null, 2))
}
