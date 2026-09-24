import type { TurnScratch } from '#state/types.js'

export function createTurnScratch(
  overrides: Partial<TurnScratch> = {},
): TurnScratch {
  return {
    actionsLeft: 0,
    extraActions: 0,
    recruited: false,
    birdsongWoodDone: false,
    eveningDrawDone: false,
    swapMeetUsed: false,
    charmOffensiveUsed: false,
    leagueUsed: false,
    propagandaUsed: false,
    saboteursUsed: false,
    falseOrdersUsed: false,
    eyrieEmigreCompleted: false,
    emergencyOrdersDone: false,
    eveningScoreDone: false,
    decree: null,
    decreeDone: false,
    ...overrides,
  }
}
