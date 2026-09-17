import { api } from '../api/client.js'

export async function cmdAct(json: string) {
  const action = JSON.parse(json) as unknown
  const { state, log } = await api.act(action)
  console.log(`applied turn=${state.turn} phase=${state.phase}/${state.step}`)
  if (log.length > 0) console.log(JSON.stringify(log, null, 2))
}
