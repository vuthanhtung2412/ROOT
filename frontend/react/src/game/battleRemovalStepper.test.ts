import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '#test/factories.ts'
import {
  buildBattleRemovalStepperChoices,
  collapsePieceIdsRemovalSpecs,
  formatBattleRemovalComboLabel,
} from '#game/battleRemovalStepper.ts'

describe('formatBattleRemovalComboLabel', () => {
  it('formats warriors then buildings', () => {
    const piecesById = new Map([
      ['w1', { id: 'w1', kind: 'warrior' }],
      ['w2', { id: 'w2', kind: 'warrior' }],
      ['b1', { id: 'b1', kind: 'building', type: 'sawmill' }],
    ])
    expect(
      formatBattleRemovalComboLabel(['w1', 'w2', 'b1'], piecesById),
    ).toBe('2 x warriors + 1 x sawmill')
  })
})

describe('buildBattleRemovalStepperChoices', () => {
  it('collapses fungible warrior combos to one choice', () => {
    const piecesById = new Map([
      ['w1', { id: 'w1', kind: 'warrior' }],
      ['w2', { id: 'w2', kind: 'warrior' }],
      ['w3', { id: 'w3', kind: 'warrior' }],
    ])
    const choices = buildBattleRemovalStepperChoices(
      [
        ['w1', 'w2'],
        ['w1', 'w3'],
        ['w2', 'w3'],
      ],
      piecesById,
    )
    expect(choices).toHaveLength(1)
    expect(choices[0]?.label).toBe('2 x warriors')
    expect(choices[0]?.pieceIds).toHaveLength(2)
  })

  it('keeps distinct building targets as separate choices', () => {
    const piecesById = new Map([
      ['w1', { id: 'w1', kind: 'warrior' }],
      ['b1', { id: 'b1', kind: 'building', type: 'sawmill' }],
      ['b2', { id: 'b2', kind: 'building', type: 'workshop' }],
    ])
    const choices = buildBattleRemovalStepperChoices(
      [
        ['w1', 'b1'],
        ['w1', 'b2'],
      ],
      piecesById,
    )
    expect(choices.map((choice) => choice.label).sort()).toEqual([
      '1 x warriors + 1 x sawmill',
      '1 x warriors + 1 x workshop',
    ])
  })
})

describe('collapsePieceIdsRemovalSpecs', () => {
  it('keeps one removal spec among many', () => {
    const collapsed = collapsePieceIdsRemovalSpecs([
      makeActionSpec({ type: 'battle' }),
      makeActionSpec({
        type: 'resolveEvent',
        params: { pieceIds: ['w1'] },
      }),
      makeActionSpec({
        type: 'resolveEvent',
        params: { pieceIds: ['w2'] },
      }),
    ])
    expect(collapsed).toHaveLength(2)
    expect(collapsed.filter((spec) => spec.type === 'resolveEvent')).toHaveLength(
      1,
    )
  })
})
