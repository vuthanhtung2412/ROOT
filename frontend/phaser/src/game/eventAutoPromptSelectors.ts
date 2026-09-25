import type { ActionSpec } from '#api/client.ts'
import { readChoiceParams } from '#game/resolution/ActionComposer.ts'

/** Collect pay-card ids from Field Hospital legal resolveEvent specs. */
export function fieldHospitalCardIdsFromSpecs(
  specs: readonly ActionSpec[],
): string[] {
  const cardIds: string[] = []
  for (const spec of specs) {
    if (spec.type !== 'resolveEvent') {
      continue
    }
    const params = readChoiceParams(spec)
    if (params.cardIds === undefined) {
      continue
    }
    for (const cardId of params.cardIds) {
      cardIds.push(cardId)
    }
  }
  return cardIds
}

export function isFieldHospitalPending(pending: unknown): boolean {
  if (typeof pending !== 'object' || pending === null) {
    return false
  }
  return Reflect.get(pending, 'type') === 'fieldHospital'
}

export function battleAmbushRole(
  pending: unknown,
): 'ambush' | 'foil' | null {
  if (typeof pending !== 'object' || pending === null) {
    return null
  }
  if (Reflect.get(pending, 'type') !== 'battle') {
    return null
  }
  const stage = Reflect.get(pending, 'stage')
  if (stage === 'ambush' || stage === 'foil') {
    return stage
  }
  return null
}

export function isBattleRemovalPending(pending: unknown): boolean {
  if (typeof pending !== 'object' || pending === null) {
    return false
  }
  if (Reflect.get(pending, 'type') !== 'battle') {
    return false
  }
  const stage = Reflect.get(pending, 'stage')
  return stage === 'removeDefender' || stage === 'removeAttacker'
}
