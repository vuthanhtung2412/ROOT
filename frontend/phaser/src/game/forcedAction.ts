import type { ActionSpec } from '#api/client.ts'

/**
 * When the only legal action for the actor is endPhase, auto-submit it.
 */
export function soleEndPhaseAction(
  legalActions: readonly ActionSpec[],
  actorSeat: number,
): ActionSpec | null {
  const forActor = legalActions.filter((spec) => spec.actor === actorSeat)
  if (forActor.length !== 1) {
    return null
  }
  const only = forActor[0]
  if (only === undefined || only.type !== 'endPhase') {
    return null
  }
  return only
}
