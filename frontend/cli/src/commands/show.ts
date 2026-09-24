import { api } from '#api/client.js'

export async function cmdShow(): Promise<void> {
  console.log(await api.gameView())
}
