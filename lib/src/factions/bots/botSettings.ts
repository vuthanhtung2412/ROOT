import { isBotFaction } from '#factions/bots/botFactions.js'
import type { Seat } from '#pieces/types.js'
import {
  DEFAULT_BOT_DIFFICULTY,
  type BotDifficulty,
  type BotTrait,
} from '#public/botSettings.js'
import { factionOf } from '#queries/seat.js'
import { addVictoryPoints } from '#rules/dominance.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { GameState } from '#state/types.js'

const NIGHTMARE_EVENING_VICTORY_POINTS = 1

/** Rule: Rootbotics 3.3.1 — a seat's difficulty; humans and unset bots play default. */
export function botDifficultyOf(state: GameState, seat: Seat): BotDifficulty {
  const faction = factionOf(state, seat)
  if (!isBotFaction(faction)) return DEFAULT_BOT_DIFFICULTY
  return state.botSettings?.[faction]?.difficulty ?? DEFAULT_BOT_DIFFICULTY
}

/** Rule: Rootbotics 3.3.2 — the trait card lies face up by the bot's board. */
export function botHasTrait(state: GameState, seat: Seat, trait: BotTrait): boolean {
  const faction = factionOf(state, seat)
  if (!isBotFaction(faction)) return false
  return state.botSettings?.[faction]?.traits.includes(trait) === true
}

/** Difficulty Nightmare — "At the end of evening, score 1 VP." */
export function scoreNightmareEvening(state: GameState, seat: Seat, ctx: Ctx): LogEntry[] {
  if (botDifficultyOf(state, seat) !== 'nightmare') return []
  const scored = addVictoryPoints(state, seat, NIGHTMARE_EVENING_VICTORY_POINTS)
  if (scored === 0) return []
  ctx.emit({ s: 'vp', actor: seat, delta: scored })
  return [{ t: 'vp', actor: seat, delta: scored, reason: 'nightmare' }]
}

/** Challenging and Nightmare both place the extra warriors (MM) / bird ambush (EE). */
export function isChallengingOrHarder(state: GameState, seat: Seat): boolean {
  const difficulty = botDifficultyOf(state, seat)
  return difficulty === 'challenging' || difficulty === 'nightmare'
}
