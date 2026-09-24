export { battleResolver, openBattle } from '#events/battle/resolver.js'
export { isValidRemoval } from '#events/battle/removal.js'
export { applyDefenseless } from '#events/battle/stages.js'
export type {
  BattleEventApply,
  EventResolver,
  OpenBattle,
  RemovalSelection,
  RemovalStage,
} from '#events/battle/types.js'
