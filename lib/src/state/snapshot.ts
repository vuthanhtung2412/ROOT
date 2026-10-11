import type { Action } from '#actions/types.js'
import type { LogEntry } from '#log/types.js'
import type { RngState } from '#rules/Rng.js'
import type { GameState } from '#state/types.js'

export type GameSnapshot = {
  state: GameState
  history: Action[]
  log: LogEntry[]
  rng: RngState
  /**
   * Parallel to `history`: false when that action was a forced phase end
   * (the only legal action). Used so turn-undo still peels forced ends after
   * a snapshot load. Absent on older snapshots: every action counts as a choice.
   */
  choiceHistory?: boolean[]
}
