import { aiPlayerApi } from '#api/client.js'

export async function cmdRules(query: string): Promise<void> {
  console.log(await aiPlayerApi.rules(query))
}
