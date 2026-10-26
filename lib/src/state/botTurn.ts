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
  /** Trait Blitz — after the move action. */
  | { kind: 'blitz' }
  | { kind: 'score' }
  | { kind: 'discardOrder' }
  /** Difficulty Nightmare — 1 VP at the end of Evening. */
  | { kind: 'nightmareScore' }

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
  /** Trait Relentless — after resolving the Decree. */
  | { kind: 'relentless' }
  /** Trait Swoop — at the end of Daylight. */
  | { kind: 'swoop' }
  /** Trait Nobility — a Decree recruit could not place every warrior. */
  | { kind: 'turmoil' }
  /** Difficulty Nightmare — 1 VP at the end of Evening. */
  | { kind: 'nightmareScore' }

/** Rule: Rootbotics 6.4–6.6 — one unit of the Automated Alliance turn. */
export type AutomatedAllianceTask =
  | { kind: 'revealOrder' }
  | { kind: 'craftOrder' }
  | { kind: 'revolt' }
  | { kind: 'publicPity' }
  | { kind: 'spreadSympathy' }
  | { kind: 'surpriseRevolt' }
  | { kind: 'organize' }
  | { kind: 'recruit' }
  | { kind: 'discardOrder' }
  /** Trait Wildfire — a spread that scores nothing, at the end of Evening. */
  | { kind: 'wildfire' }
  /** Difficulty Nightmare — 1 VP at the end of Evening. */
  | { kind: 'nightmareScore' }

export type BotTask = MechanicalMarquiseTask | ElectricEyrieTask | AutomatedAllianceTask

/** Work a bot still has in one step of its turn, done one task at a time. */
export type BotPlan = {
  phase: Phase
  step: Step
  tasks: BotTask[]
}
