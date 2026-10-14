import { describe, expect, it } from 'vitest'
import { battleRoleRemovingPieces } from '#ui/BattleOverlay.ts'

describe('battleRoleRemovingPieces', () => {
  it('names the side that removes pieces', () => {
    expect(battleRoleRemovingPieces('removeDefender')).toBe('defender')
    expect(battleRoleRemovingPieces('removeAttacker')).toBe('attacker')
  })

  it('names nobody while the dice are rolled', () => {
    expect(battleRoleRemovingPieces('roll')).toBeNull()
  })
})
