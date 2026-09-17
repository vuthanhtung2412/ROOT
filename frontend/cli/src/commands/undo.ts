import { api } from '../api/client.js'

export async function cmdUndo() {
  const { state } = await api.undo()
  console.log(`undone turn=${state.turn} phase=${state.phase}/${state.step} history restored`)
}
