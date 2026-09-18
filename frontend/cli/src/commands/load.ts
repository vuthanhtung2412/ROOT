import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { api } from '../api/client.js'

export async function cmdLoad(path: string) {
  const abs = resolve(path)
  const raw = await readFile(abs, 'utf8')
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw new Error(`invalid JSON: ${abs}`)
  }
  const { state } = await api.loadSnapshot(body)
  console.log(`loaded ${abs}`)
  const current = state.players.find((p) => p.seat === state.currentSeat)
  const who = current ? `${current.faction}/${current.playerId}` : 'nobody'
  console.log(
    `game ${state.id} status=${state.status} turn=${state.turn} ${who}`,
  )
}
