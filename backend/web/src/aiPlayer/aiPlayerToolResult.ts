import type { Game } from '@root/lib'
import type { RuleSection } from '#aiPlayer/rulebook.js'

export type AiPlayerToolResult = {
  content: string
  isError: boolean
  /** True when the call changed the game (an applied `act`). */
  appliedAction: boolean
}

/** Everything a tool may touch: one game, seen and played as one seat. */
export type AiPlayerToolContext = {
  game: Game
  playerId: string
  rulebook: readonly RuleSection[]
  /** Called after an applied action: save the slot, push it to viewers. */
  onGameChanged: () => void
}

const JSON_INDENT_SPACES = 2

export function succeed(content: string): AiPlayerToolResult {
  return { content, isError: false, appliedAction: false }
}

export function fail(content: string): AiPlayerToolResult {
  return { content, isError: true, appliedAction: false }
}

export function formatJson(value: object): string {
  return JSON.stringify(value, null, JSON_INDENT_SPACES)
}
