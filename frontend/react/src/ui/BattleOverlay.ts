export type BattleOverlayViewModel = {
  clearing: number
  stage: string
  attackerFaction: string
  defenderFaction: string
  /** Root battle dice: [higher → attacker, lower → defender]. */
  rolls: readonly [number, number] | null
  hits: { attacker: number; defender: number }
  /** Non-null while a side is taking its hits. */
  removal: BattleRemoval | null
  prompt: string | null
  /** Non-null while the post-battle result flash is up. */
  outcomeMessage: string | null
}

export type BattleRole = 'attacker' | 'defender'

/** The side removing its pieces right now; null outside the removal stages. */
export function battleRoleRemovingPieces(stage: string): BattleRole | null {
  if (stage === 'removeDefender') {
    return 'defender'
  }
  if (stage === 'removeAttacker') {
    return 'attacker'
  }
  return null
}

/**
 * What the hits cost the side taking them: pieces off the map, Vagabond
 * items damaged, or bare hits when the game has not said which.
 */
export type BattleRemovalUnit = 'piece' | 'item' | 'hit'

export type BattleRemoval = {
  count: number
  unit: BattleRemovalUnit
}

const BATTLE_REMOVAL_VERBS: Record<BattleRemovalUnit, string> = {
  piece: 'remove',
  item: 'damage',
  hit: 'take',
}

/** "1 piece", "2 pieces". */
export function countedNounText(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${String(count)} ${noun}s`
}

/** "remove 2 pieces", "damage 1 item", "take 3 hits". */
export function battleRemovalText(removal: BattleRemoval): string {
  const verb: string = BATTLE_REMOVAL_VERBS[removal.unit]
  return `${verb} ${countedNounText(removal.count, removal.unit)}`
}
