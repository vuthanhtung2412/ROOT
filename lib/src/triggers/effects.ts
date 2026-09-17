import type { ActionSpec } from '../actions/types.js'
import type { GameState } from '../state/types.js'
import type { Ctx } from '../game/ctx.js'
import type { GameSignal } from './signals.js'
import type { RuleHooks } from './hooks.js'

export type Listener = (state: GameState, signal: GameSignal, ctx: Ctx) => void

export type CardEffect = {
  defId: string
  onSignal?: Listener
  hooks?: Partial<RuleHooks>
  grants?: (state: GameState) => ActionSpec[]
}

/** Registered persistent/partisan card effects (Phase 7b). */
export const EFFECTS: Record<string, CardEffect> = {}
