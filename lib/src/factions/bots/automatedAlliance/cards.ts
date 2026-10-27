import { botDifficultyOf, botHasTrait, isChallengingOrHarder } from '#factions/bots/botSettings.js'
import type { Seat } from '#pieces/types.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 6.6.1 — Organize with three or more warriors. */
const DEFAULT_ORGANIZE_WARRIORS = 3
/** Difficulty Easy — "Organize if there are 4 or more warriors in the clearing." */
const EASY_ORGANIZE_WARRIORS = 4
/** Difficulty Challenging / Nightmare — "Organize if there are 2 or more warriors." */
const CHALLENGING_ORGANIZE_WARRIORS = 2

/** Warriors a clearing with a base needs before the Alliance organizes there. */
export function organizeWarriors(state: GameState, seat: Seat): number {
  if (isChallengingOrHarder(state, seat)) return CHALLENGING_ORGANIZE_WARRIORS
  if (botDifficultyOf(state, seat) === 'easy') return EASY_ORGANIZE_WARRIORS
  return DEFAULT_ORGANIZE_WARRIORS
}

/** Trait Steadfast — "Ignore Martial Law." */
export function ignoresMartialLaw(state: GameState, seat: Seat): boolean {
  return botHasTrait(state, seat, 'steadfast')
}

/** Trait Veterans — as defender the Alliance uses the higher roll. */
export function usesHigherRollAsDefender(state: GameState, seat: Seat): boolean {
  return botHasTrait(state, seat, 'veterans')
}

/** Trait Popularity — opponents score nothing for its sympathy tokens. */
export function sympathyScoresNothing(state: GameState, owner: Seat): boolean {
  return botHasTrait(state, owner, 'popularity')
}
