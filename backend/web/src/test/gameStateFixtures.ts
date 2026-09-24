import { Game, type GameState } from '@root/lib'

export type TestPlayerInput = {
  playerId: string
  hand?: Array<{ id: string; defId: string }>
}

export function createTwoPlayerGameState(
  players: [TestPlayerInput, TestPlayerInput],
): GameState {
  const game = Game.create({ seed: 1 })
  game.join(players[0].playerId)
  game.join(players[1].playerId)
  game.state.players[0]!.hand = [...(players[0].hand ?? [])]
  game.state.players[1]!.hand = [...(players[1].hand ?? [])]
  return game.state
}
