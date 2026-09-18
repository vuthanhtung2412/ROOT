import { api } from '../api/client.js'

export async function cmdMap() {
  const [{ state }, ascii] = await Promise.all([api.get(), api.mapAscii()])
  console.log(`turn=${state.turn} phase=${state.phase}/${state.step}`)
  for (const p of state.players) {
    console.log(`${p.faction}/${p.playerId} vp=${p.vp}`)
  }
  console.log('')
  console.log(ascii)
}
