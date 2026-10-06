/** Pending events of the Lizard Cult and the Riverfolk Company. */

/** `type` of an opaque pending event; null when it has none. */
export function pendingEventType(pending: unknown): string | null {
  if (typeof pending !== 'object' || pending === null) {
    return null
  }
  const type: unknown = Reflect.get(pending, 'type')
  return typeof type === 'string' ? type : null
}

const EXPANSION_PENDING_PROMPTS: Readonly<Record<string, string>> = {
  chooseCultCorner: 'Lizard Cult — choose starting corner',
  chooseOutcast: 'Lizard Cult — choose the Outcast suit',
  placeRiverfolkWarrior: 'Riverfolk Company — place a warrior on the river',
  setStartingCosts: 'Riverfolk Company — set starting service costs',
  buyServices: 'Riverfolk services — buy or decline',
}

/** Banner prompt for an expansion pending event; null for any other event. */
export function expansionPendingPrompt(pending: unknown): string | null {
  const type = pendingEventType(pending)
  if (type === null) {
    return null
  }
  return EXPANSION_PENDING_PROMPTS[type] ?? null
}
