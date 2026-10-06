import { describe, expect, it } from 'vitest'
import {
  BATTLE_FINISHED_STAGE,
  BATTLE_STEPS,
  battleRoleRemovingPieces,
  battleStepIndex,
} from '#ui/BattleOverlay.ts'

const UNKNOWN_STAGE = 'notAStage'
const OFF_TRACK = -1

describe('battleStepIndex', () => {
  it('puts both removal stages on the same step', () => {
    expect(battleStepIndex('removeDefender')).toBe(
      battleStepIndex('removeAttacker'),
    )
  })

  it('ends the track on the finished stage', () => {
    expect(battleStepIndex(BATTLE_FINISHED_STAGE)).toBe(BATTLE_STEPS.length - 1)
  })

  it('leaves an unknown stage off the track', () => {
    expect(battleStepIndex(UNKNOWN_STAGE)).toBe(OFF_TRACK)
  })
})

describe('battleRoleRemovingPieces', () => {
  it('names the side that removes pieces', () => {
    expect(battleRoleRemovingPieces('removeDefender')).toBe('defender')
    expect(battleRoleRemovingPieces('removeAttacker')).toBe('attacker')
  })

  it('names nobody while the dice are rolled', () => {
    expect(battleRoleRemovingPieces('roll')).toBeNull()
  })
})
