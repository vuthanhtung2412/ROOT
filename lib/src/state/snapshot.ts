import type { Action } from '../actions/types.js'
import type { LogEntry } from '../log/types.js'
import type { RngState } from '../rules/Rng.js'
import type { GameState } from './types.js'

export type GameSnapshot = {
  state: GameState
  history: Action[]
  log: LogEntry[]
  rng: RngState
}
