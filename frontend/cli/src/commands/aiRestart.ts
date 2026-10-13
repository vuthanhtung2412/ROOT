import { aiPlayerApi } from '#api/client.js'

export async function cmdAiRestart(seat: number): Promise<void> {
  const aiPlayers = await aiPlayerApi.restartAiPlayer(seat)
  for (const aiPlayer of aiPlayers) {
    console.log(
      `seat ${String(aiPlayer.seat)} ${aiPlayer.model} ${aiPlayer.status}`,
    )
  }
}
