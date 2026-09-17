import type { GameMap } from '../map/GameMap.js'
import type { GameState } from '../state/types.js'
import { EFFECTS } from './effects.js'
import { defaultRuleHooks, type RuleHooks } from './hooks.js'

function activeEffects(state: GameState) {
  const out: (typeof EFFECTS)[string][] = []
  for (const player of state.players) {
    for (const card of player.playArea) {
      const effect = EFFECTS[card.defId]
      if (effect) out.push(effect)
    }
  }
  return out
}

/** Fold card-effect hook overrides over base map hooks (owner = seat). */
export function buildRuleHooks(state: GameState, map: GameMap): RuleHooks {
  const base = defaultRuleHooks(map)
  const effects = activeEffects(state)

  return {
    isAdjacent(state, seat, a, b) {
      if (base.isAdjacent(state, seat, a, b)) return true
      for (const effect of effects) {
        if (effect.hooks?.isAdjacent?.(state, seat, a, b)) return true
      }
      return false
    },
    ruleWeight(state, piece) {
      let weight = base.ruleWeight(state, piece)
      for (const effect of effects) {
        const w = effect.hooks?.ruleWeight?.(state, piece)
        if (w !== undefined && w > weight) weight = w
      }
      return weight
    },
    needsRuleToMove(state, seat) {
      for (const effect of effects) {
        const v = effect.hooks?.needsRuleToMove?.(state, seat)
        if (v !== undefined) return v
      }
      return base.needsRuleToMove(state, seat)
    },
    extraHits(state, ev, side) {
      let total = base.extraHits(state, ev, side)
      for (const effect of effects) {
        total += effect.hooks?.extraHits?.(state, ev, side) ?? 0
      }
      return total
    },
    craftVp(state, seat, card) {
      let vp = base.craftVp(state, seat, card)
      for (const effect of effects) {
        const v = effect.hooks?.craftVp?.(state, seat, card)
        if (v !== undefined) vp = v
      }
      return vp
    },
  }
}
