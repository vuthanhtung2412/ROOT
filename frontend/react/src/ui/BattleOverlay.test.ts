import { describe, expect, it } from 'vitest'
import {
  battleRoleRemovingPieces,
  battleStrapText,
  type BattleStrapInput,
} from '#ui/BattleOverlay.ts'

function makeBattle(overrides: Partial<BattleStrapInput> = {}): BattleStrapInput {
  return {
    stage: 'removeDefender',
    attackerFaction: 'marquise',
    defenderFaction: 'eyrie',
    hits: { attacker: 2, defender: 1 },
    removal: { count: 2, unit: 'piece' },
    ...overrides,
  }
}

describe('battleRoleRemovingPieces', () => {
  it('names the side that removes pieces', () => {
    expect(battleRoleRemovingPieces('removeDefender')).toBe('defender')
    expect(battleRoleRemovingPieces('removeAttacker')).toBe('attacker')
  })

  it('names nobody while the dice are rolled', () => {
    expect(battleRoleRemovingPieces('roll')).toBeNull()
  })
})

describe('battleStrapText', () => {
  it('tells the defender to remove the hits the attacker dealt', () => {
    expect(battleStrapText(makeBattle())).toBe('eyrie — remove 2 pieces')
  })

  it('tells the attacker to remove the hits the defender dealt', () => {
    expect(
      battleStrapText(
        makeBattle({
          stage: 'removeAttacker',
          removal: { count: 1, unit: 'piece' },
        }),
      ),
    ).toBe('marquise — remove 1 piece')
  })

  it('tells a Vagabond to damage items instead of removing pieces', () => {
    expect(
      battleStrapText(
        makeBattle({
          defenderFaction: 'vagabond',
          removal: { count: 2, unit: 'item' },
        }),
      ),
    ).toBe('vagabond — damage 2 items')
  })

  it('tells a Vagabond the hits taken when no item count is known', () => {
    expect(
      battleStrapText(
        makeBattle({
          defenderFaction: 'vagabond',
          removal: { count: 3, unit: 'hit' },
        }),
      ),
    ).toBe('vagabond — take 3 hits')
  })

  it('falls back to the stage label outside removal', () => {
    expect(battleStrapText(makeBattle({ stage: 'roll', removal: null }))).toBe(
      'Rolling…',
    )
  })
})
