import type { Game } from '@root/lib'

export type GameStore = {
  game: Game | null
}

export const store: GameStore = { game: null }
