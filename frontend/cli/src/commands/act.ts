import { api } from '#api/client.js'

export async function cmdAct(json: string): Promise<void> {
  const action: unknown = JSON.parse(json)
  const { state, log } = await api.submitAction(action)
  console.log(`applied turn=${state.turn} phase=${state.phase}/${state.step}`)
  if (log.length > 0) console.log(JSON.stringify(log, null, 2))
}
