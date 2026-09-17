import { api } from '../api/client.js'

export async function cmdLog() {
  const { log } = await api.log()
  console.log(JSON.stringify(log, null, 2))
}
