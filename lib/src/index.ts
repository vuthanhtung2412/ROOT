export { Game } from './game/Game.js'
export type { Ctx } from './game/ctx.js'

export { Faction, FACTIONS, Marquise, MARQUISE, keepCornerFor, Eyrie, EYRIE } from './factions/index.js'

export { TurnLog } from './log/TurnLog.js'
export type { LogEntry } from './log/types.js'

export type { Action, ActionSpec, ActionResult } from './actions/types.js'
export type { FactionId, Seat } from './pieces/types.js'
export type { GameState, GameStatus, Phase, Step, PlayerState } from './state/types.js'
export type { GameSnapshot } from './state/snapshot.js'
export {
  DEFAULT_FACTIONS,
  ITEM_SUPPLY,
  RUIN_ITEMS,
  HAND_LIMIT,
  STARTING_HAND,
} from './state/constants.js'

export { FALL } from './map/fall.js'
export { FALL_LAYOUT } from './layout/fall.js'
export type { MapLayout } from './layout/types.js'
export { toSvg } from './layout/render/svg.js'
export { toAscii } from './layout/render/ascii.js'
export type { AsciiOpts } from './layout/render/ascii.js'
export { defOf } from './cards/Deck.js'
export { RuleError } from './rules/RuleError.js'
export { SeededRng, type Rng, type RngState } from './rules/Rng.js'
export {
  formatGameView,
  formatGameLogEntry,
  formatStateDiff,
  formatPlayersClearingsDiff,
  diffLines,
  formatTurnLog,
  describeAction,
  describeLogEntry,
  cardLabel,
  playerRef,
} from './format/prettyState.js'
export type { PrettyGameOpts, FormatGameLogOpts } from './format/prettyState.js'

export const LIB_NAME = '@root/lib' as const
export const LIB_VERSION = '0.0.1' as const
