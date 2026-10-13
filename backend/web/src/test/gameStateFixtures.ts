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

export const FIRST_TEST_PLAYER_ID = 'first-player'
export const SECOND_TEST_PLAYER_ID = 'second-player'
/** Seat 0 (Marquise) owes the first setup choice: the keep corner. */
export const KEEP_CORNER_ACTION = { type: 'resolveEvent', clearing: 0 } as const

/** Marquise (seat 0) vs Eyrie (seat 1), started: setup choices are pending. */
export function createStartedTwoPlayerGame(): Game {
  const game = Game.create({ seed: 1, factions: ['marquise', 'eyrie'] })
  game.join(FIRST_TEST_PLAYER_ID)
  game.join(SECOND_TEST_PLAYER_ID)
  game.start()
  return game
}
