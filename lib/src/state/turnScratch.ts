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
    phaseActionTaken: false,
    emergencyOrdersDone: false,
    eveningScoreDone: false,
    decree: null,
    decreeDone: false,
    militaryOpsLeft: 0,
    sympathyCraftedIds: [],
    slipDone: false,
    aidsThisTurn: {},
    outcastAdjusted: false,
    ritualScoredSuits: [],
    crusadeFollowUpClearing: null,
    fundsGathered: false,
    riverboats: false,
    mercenaries: false,
    ...overrides,
  }
}
