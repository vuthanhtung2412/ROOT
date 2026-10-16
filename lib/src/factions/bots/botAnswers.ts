import type { ActionSpec, ResolveEventAction } from '#actions/types.js'
import type { Event } from '#events/types.js'
import { randomIndex, type Rng } from '#rules/Rng.js'

function removalChoices(specs: readonly ActionSpec[]): string[][] {
  return specs
    .map((spec: ActionSpec): string[] | undefined => spec.params?.pieceIds)
    .filter(
      (pieceIds: string[] | undefined): pieceIds is string[] =>
        pieceIds !== undefined,
    )
}

/**
 * What a bot answers when a pending event waits on it. Bots never play
 * cards (Rootbotics 2.8): they decline, use no battle effects, let the
 * attacker order effects as offered, and remove hits per 1.2.1 — the legal
 * removals already put tokens first, the building is picked at random.
 */
export function botEventAnswer(
  event: Event,
  specs: readonly ActionSpec[],
  rng: Rng,
): ResolveEventAction | null {
  const declineSpec = specs.find(
    (spec: ActionSpec): boolean => spec.params?.decline?.includes(true) === true,
  )
  if (declineSpec !== undefined) {
    return { type: 'resolveEvent', decline: true }
  }
  if (event.type === 'battle') {
    const removals: string[][] = removalChoices(specs)
    if (removals.length > 0) {
      const pieceIds = removals[randomIndex(rng, removals.length)]!
      return { type: 'resolveEvent', pieceIds }
    }
    const order = specs[0]?.params?.order?.[0]
    if (order !== undefined) return { type: 'resolveEvent', order }
    const useEffect = specs.some(
      (spec: ActionSpec): boolean => spec.params?.useEffect !== undefined,
    )
    if (useEffect) return { type: 'resolveEvent', useEffect: false }
  }
  return null
}
