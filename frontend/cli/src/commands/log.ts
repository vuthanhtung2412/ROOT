import { api } from '#api/client.js'

export async function cmdLog(): Promise<void> {
  console.log(await api.formattedGameLog())
}
