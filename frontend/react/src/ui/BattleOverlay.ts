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

/** One step of the progress track shown under the battle headline. */
export type BattleStep = {
  label: string
  /** Battle stages that belong to this step. */
  stages: readonly string[]
}

export const BATTLE_FINISHED_STAGE = 'finished'

export const BATTLE_STEPS: readonly BattleStep[] = [
  { label: 'Roll', stages: ['roll'] },
  { label: 'Effects', stages: ['effectsOrder', 'effects'] },
  { label: 'Remove', stages: ['removeDefender', 'removeAttacker'] },
  { label: 'Done', stages: [BATTLE_FINISHED_STAGE] },
]

/** Index of the step a stage belongs to; -1 for a stage off the track. */
export function battleStepIndex(stage: string): number {
  return BATTLE_STEPS.findIndex((step: BattleStep): boolean =>
    step.stages.includes(stage),
  )
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
