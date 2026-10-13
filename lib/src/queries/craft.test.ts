import { describe, expect, it } from 'vitest'
import { minimalState, withPieces, card, player, marquiseBoard } from '#test/fixtures.js'
import { FALL } from '#map/fall.js'
import { canCraft, unusedCraftingSuits } from '#queries/craft.js'

describe('canCraft', () => {
  it('Rule: Craft 1 — activate crafting pieces matching cost suits', () => {
    const state = withPieces(minimalState(), 0, [
      {
        id: 'ws',
        kind: 'building',
        owner: 0,
        type: 'workshop',
        used: false,
      },
    ])
    expect(canCraft(state, 0, card('ROOT-204'))).toBe(true)
  })

  it('Rule: Craft 2 — crafting piece suit = clearing suit', () => {
    const state = withPieces(minimalState(), 1, [
      {
        id: 'ws',
        kind: 'building',
        owner: 0,
        type: 'workshop',
        used: false,
      },
    ])
    expect(canCraft(state, 0, card('ROOT-204'))).toBe(false)
  })

  it('Rule: Craft 3 — each crafting piece activates once per turn', () => {
    const state = withPieces(minimalState(), 0, [
      {
        id: 'ws',
        kind: 'building',
        owner: 0,
        type: 'workshop',
        used: true,
      },
    ])
    expect(canCraft(state, 0, card('ROOT-204'))).toBe(false)
  })

  it('Rule: Craft 4 — missing supply item → cannot craft', () => {
    const state = withPieces(
      minimalState({ itemSupply: { ...minimalState().itemSupply, hammer: 0 } }),
      0,
      [
        {
          id: 'ws',
          kind: 'building',
          owner: 0,
          type: 'workshop',
          used: false,
        },
      ],
    )
    expect(canCraft(state, 0, card('ROOT-204'))).toBe(false)
  })

  it('Rule: Craft — no duplicate identical persistent', () => {
    const persistent = card('ROOT-57')
    const state = minimalState({
      players: [
        player(0, 'marquise', { board: marquiseBoard(), playArea: [persistent] }),
        player(1, 'marquise'),
      ],
    })
    const withWorkshop = withPieces(state, 0, [
      {
        id: 'ws',
        kind: 'building',
        owner: 0,
        type: 'workshop',
        used: false,
      },
      {
        id: 'ws2',
        kind: 'building',
        owner: 0,
        type: 'workshop',
        used: false,
      },
    ])
    expect(canCraft(withWorkshop, 0, card('ROOT-57'))).toBe(false)
  })

  it('Rule: Craft — ambush with empty cost is not craftable', () => {
    const state = withPieces(minimalState(), 0, [
      { id: 'ws', kind: 'building', owner: 0, type: 'workshop', used: false },
    ])
    expect(canCraft(state, 0, card('ROOT-201'))).toBe(false)
  })

  it('Rule: Craft — dominance is not craftable', () => {
    const state = withPieces(minimalState(), 0, [
      { id: 'ws', kind: 'building', owner: 0, type: 'workshop', used: false },
    ])
    expect(canCraft(state, 0, card('ROOT-211'))).toBe(false)
  })

  it('Rule: Craft 3 — used roost cannot craft again same turn', () => {
    const state = withPieces(minimalState(), 0, [
      { id: 'r', kind: 'building', owner: 0, type: 'roost', used: true },
    ])
    expect(canCraft(state, 0, card('ROOT-204'))).toBe(false)
  })

  it('Rule: Craft 3 — refreshed roost can craft next turn', () => {
    const state = withPieces(minimalState(), 0, [
      { id: 'r', kind: 'building', owner: 0, type: 'roost', used: true },
    ])
    const roost = state.clearings[0]!.pieces[0]
    expect(roost?.kind).toBe('building')
    if (roost?.kind === 'building' && roost.type === 'roost') {
      roost.used = false
    } else {
      throw new Error('expected roost')
    }
    expect(canCraft(state, 0, card('ROOT-204'))).toBe(true)
  })

  it('Rule: Craft — removed roost is unavailable immediately', () => {
    const state = withPieces(minimalState(), 0, [
      { id: 'r', kind: 'building', owner: 0, type: 'roost', used: false },
    ])
    state.clearings[0]!.pieces = []
    expect(canCraft(state, 0, card('ROOT-204'))).toBe(false)
  })
})

describe('unusedCraftingSuits', () => {
  it('lists one suit per crafting piece that is not used yet', () => {
    const state = withPieces(
      withPieces(minimalState(), 0, [
        { id: 'ws-1', kind: 'building', owner: 0, type: 'workshop', used: false },
        { id: 'ws-2', kind: 'building', owner: 0, type: 'workshop', used: true },
        { id: 'saw', kind: 'building', owner: 0, type: 'sawmill' },
      ]),
      1,
      [
        { id: 'ws-3', kind: 'building', owner: 0, type: 'workshop', used: false },
        { id: 'roost', kind: 'building', owner: 1, type: 'roost', used: false },
      ],
    )

    expect(unusedCraftingSuits(state, 0)).toEqual([
      FALL.clearings[0]?.suit,
      FALL.clearings[1]?.suit,
    ])
  })
})
