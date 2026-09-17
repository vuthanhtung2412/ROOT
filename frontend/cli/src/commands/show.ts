import { api } from '../api/client.js'

export async function cmdShow() {
  const { state, historyLength } = await api.get()
  console.log(`id=${state.id} seed=${state.seed} status=${state.status}`)
  console.log(`turn=${state.turn} seat=${state.currentSeat} phase=${state.phase}/${state.step}`)
  if (state.winner !== undefined) console.log(`winner=seat ${state.winner}`)
  for (const p of state.players) {
    console.log(`  seat ${p.seat} ${p.playerId} (${p.faction}) vp=${p.vp} hand=${p.hand.length}`)
  }
  console.log(`history=${historyLength}`)
}
