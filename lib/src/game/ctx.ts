import type { GameMap } from '../map/GameMap.js'
import type { Rng } from '../rules/Rng.js'
import type { RuleHooks } from '../triggers/hooks.js'
import type { GameSignal } from '../triggers/signals.js'

export type Ctx = {
  map: GameMap
  rng: Rng
  emit: (signal: GameSignal) => void
  hooks: RuleHooks
  grantedActions: () => import('../actions/types.js').ActionSpec[]
}
