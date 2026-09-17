import { api } from '../api/client.js'

export async function cmdNew(factions?: string[]) {
  const { state } = await api.create(factions)
  console.log(`game ${state.id} seed=${state.seed} factions=${state.factions.join(',')}`)
  console.log(`status=${state.status}`)
}
