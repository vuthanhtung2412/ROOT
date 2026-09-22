import type { Action } from '#actions/types.js'
import type { GameState } from '#state/types.js'
import type { LogEntry } from '#log/types.js'

export class TurnLog {
  readonly entries: LogEntry[]

  constructor(entries: LogEntry[]) {
    this.entries = entries
  }

  /** Actions taken by currentSeat since their latest birdsong this turn. */
  actionsThisTurn(state: GameState): Action[] {
    const actions: Action[] = []
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]!
      if (entry.t === 'action' && entry.actor === state.currentSeat) {
        actions.unshift(entry.action)
        continue
      }
      if (
        entry.t === 'phase' &&
        entry.phase === 'birdsong' &&
        entry.actor === state.currentSeat
      ) {
        break
      }
    }
    return actions
  }
}
