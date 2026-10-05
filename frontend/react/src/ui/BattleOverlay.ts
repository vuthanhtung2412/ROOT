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
