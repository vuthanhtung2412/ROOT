import type { CardSuit } from '#cards/types.js'
import { botDifficultyOf, botHasTrait, isChallengingOrHarder } from '#factions/bots/botSettings.js'
import type { Seat } from '#pieces/types.js'
import type { GameState } from '#state/types.js'

export type VagabotAction = 'explore' | 'quest' | 'aid' | 'battle' | 'repair' | 'special'

/** Rule: Rootbotics 7.5 / Vagabot board — Daylight Actions by order suit. */
export const DAYLIGHT_ACTIONS: Readonly<Record<CardSuit, readonly VagabotAction[]>> = {
  fox: ['explore', 'battle', 'special'],
  rabbit: ['battle', 'repair', 'special'],
  mouse: ['quest', 'aid', 'battle', 'repair'],
  bird: ['explore', 'quest', 'aid', 'battle'],
}

/** Trait Questing — "Use these updated Daylight actions". */
const QUESTING_DAYLIGHT_ACTIONS: Readonly<Record<CardSuit, readonly VagabotAction[]>> = {
  fox: ['explore', 'special', 'battle'],
  rabbit: ['special', 'aid', 'battle'],
  mouse: ['quest', 'aid', 'battle'],
  bird: ['explore', 'quest', 'battle'],
}

/** Rule: Rootbotics 7.5.2 — one point per quest; Questing: one more. */
const QUEST_VICTORY_POINTS = 1
const QUESTING_EXTRA_VICTORY_POINTS = 1
/** Rule: Rootbotics 7.5.3 — the aided human draws one card per item; Helper: two. */
const CARDS_PER_AIDED_ITEM = 1
const HELPER_CARDS_PER_AIDED_ITEM = 2
/** Trait Helper — "score an additional victory point". */
const HELPER_EXTRA_VICTORY_POINTS = 1
/** Difficulty Easy refreshes one less item; Challenging / Nightmare one more. */
const EASY_REFRESH_BONUS = -1
const CHALLENGING_REFRESH_BONUS = 1

export function daylightActionsOf(
  state: GameState,
  seat: Seat,
): Readonly<Record<CardSuit, readonly VagabotAction[]>> {
  return botHasTrait(state, seat, 'questing') ? QUESTING_DAYLIGHT_ACTIONS : DAYLIGHT_ACTIONS
}

export function questVictoryPoints(state: GameState, seat: Seat): number {
  return (
    QUEST_VICTORY_POINTS +
    (botHasTrait(state, seat, 'questing') ? QUESTING_EXTRA_VICTORY_POINTS : 0)
  )
}

export type AidSettings = {
  bonusVictoryPoints: number
  cardsPerItem: number
  /** Trait Questing — moves to a player with crafted items. */
  travels: boolean
}

export function aidSettings(state: GameState, seat: Seat): AidSettings {
  const helper = botHasTrait(state, seat, 'helper')
  return {
    bonusVictoryPoints: helper ? HELPER_EXTRA_VICTORY_POINTS : 0,
    cardsPerItem: helper ? HELPER_CARDS_PER_AIDED_ITEM : CARDS_PER_AIDED_ITEM,
    travels: botHasTrait(state, seat, 'questing'),
  }
}

/** Difficulty — items refreshed in Evening beyond the board's four / six. */
export function refreshBonus(state: GameState, seat: Seat): number {
  if (isChallengingOrHarder(state, seat)) return CHALLENGING_REFRESH_BONUS
  return botDifficultyOf(state, seat) === 'easy' ? EASY_REFRESH_BONUS : 0
}
