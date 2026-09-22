import type { ActionSpec } from '#actions/types.js'
import type { GameState } from '#state/types.js'
import type { Ctx } from '#game/ctx.js'
import type { GameSignal } from '#triggers/signals.js'
import type { RuleHooks } from '#triggers/hooks.js'

export type Listener = (state: GameState, signal: GameSignal, ctx: Ctx) => void

/** Partial hook overrides may return `undefined` to skip (fold in buildRuleHooks). */
export type RuleHookOverrides = {
  [HookName in keyof RuleHooks]?: (
    ...args: Parameters<RuleHooks[HookName]>
  ) => ReturnType<RuleHooks[HookName]> | undefined
}

export type CardEffect = {
  defId: string
  onSignal?: Listener
  hooks?: RuleHookOverrides
  grants?: (state: GameState) => ActionSpec[]
  /** When true, Game skips this auto action (e.g. Informants replace evening draw). */
  blocksAuto?: (state: GameState, action: ActionSpec | { type: string }) => boolean
}

/** Registered persistent/partisan card effects (Phase 7b). */
export const EFFECTS: Record<string, CardEffect> = {}
