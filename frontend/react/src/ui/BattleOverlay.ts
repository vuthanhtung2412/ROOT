export type BattleOverlayViewModel = {
  clearing: number
  stage: string
  attackerFaction: string
  defenderFaction: string
  /** Root battle dice: [higher → attacker, lower → defender]. */
  rolls: readonly [number, number] | null
  hits: { attacker: number; defender: number }
  prompt: string | null
  /** Brief post-battle message (e.g. zero hits). */
  outcomeMessage: string | null
}

export const BATTLE_STAGE_LABELS: Record<string, string> = {
  ambush: 'Ambush?',
  foil: 'Foil ambush?',
  roll: 'Rolling…',
  effectsOrder: 'Choose effects order',
  effects: 'Battle card effect?',
  removeDefender: 'Remove defender pieces',
  removeAttacker: 'Remove attacker pieces',
}

export function battleResultFlashPrompt(hits: {
  attacker: number
  defender: number
}): string {
  if (hits.attacker === 0 && hits.defender === 0) {
    return 'No pieces removed'
  }
  return ''
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

export type BattleStrapInput = {
  stage: string
  attackerFaction: string
  defenderFaction: string
  hits: { attacker: number; defender: number }
}

/**
 * One line under the battle: who removes how many pieces (the hits the other
 * side dealt), otherwise what the stage is waiting for.
 */
export function battleStrapText(battle: BattleStrapInput): string {
  const removingRole: BattleRole | null = battleRoleRemovingPieces(battle.stage)
  if (removingRole === null) {
    return BATTLE_STAGE_LABELS[battle.stage] ?? battle.stage
  }
  const faction: string =
    removingRole === 'defender'
      ? battle.defenderFaction
      : battle.attackerFaction
  const pieceCount: number =
    removingRole === 'defender' ? battle.hits.attacker : battle.hits.defender
  const pieces: string = pieceCount === 1 ? '1 piece' : `${String(pieceCount)} pieces`
  return `${faction} — remove ${pieces}`
}
