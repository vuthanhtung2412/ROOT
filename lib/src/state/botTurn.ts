import type { CardSuit } from '#cards/types.js'
import type { ClearingId } from '#map/types.js'
import type { Phase, Step } from '#state/types.js'

/** Rule: Rootbotics 4.4–4.7 — one unit of the Mechanical Marquise turn. */
export type MechanicalMarquiseTask =
  | { kind: 'revealOrder' }
  | { kind: 'craftOrder' }
  | { kind: 'battle'; clearing: ClearingId }
  | { kind: 'recruit' }
  | { kind: 'build' }
  | { kind: 'move'; clearing: ClearingId }
  | { kind: 'expand' }
  | { kind: 'escalatedRecruit' }
  | { kind: 'escalatedBuild' }
  | { kind: 'escalatedMoves' }
  | { kind: 'score' }
  | { kind: 'discardOrder' }

/** Rule: Rootbotics 5.4–5.6 — one unit of the Electric Eyrie turn. */
export type ElectricEyrieTask =
  | { kind: 'revealOrder' }
  | { kind: 'craftOrder' }
  | { kind: 'addToDecree' }
  | { kind: 'newRoost' }
  | { kind: 'decreeRecruit'; column: CardSuit }
  | { kind: 'decreeMove'; column: CardSuit }
  | { kind: 'decreeBattle'; column: CardSuit }
  | { kind: 'buildRoost' }
  | { kind: 'scoreRoosts' }

export type BotTask = MechanicalMarquiseTask | ElectricEyrieTask

/** Work a bot still has in one step of its turn, done one task at a time. */
export type BotPlan = {
  phase: Phase
  step: Step
  tasks: BotTask[]
}
