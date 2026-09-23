import { describe, expect, it } from 'vitest'
import {
  buildFactionBoardViewModelFromPlayer,
  formatDecreeSuitCounts,
} from '#ui/factionBoardViewModel.ts'

describe('formatDecreeSuitCounts', () => {
  it('groups suits as bird xN, fox xN…', () => {
    expect(
      formatDecreeSuitCounts([
        'fox',
        'fox',
        'mouse',
        'mouse',
        'rabbit',
        'rabbit',
        'bird',
        'bird',
      ]),
    ).toBe('bird x2, fox x2, mouse x2, rabbit x2')
  })

  it('empty is em dash', () => {
    expect(formatDecreeSuitCounts([])).toBe('—')
  })
})

describe('buildFactionBoardViewModelFromPlayer', () => {
  it('Marquise: supply + emptied columns from placed tracks', () => {
    const view = buildFactionBoardViewModelFromPlayer({
      seat: 0,
      faction: 'marquise',
      vp: 4,
      hand: [{ id: 'a', defId: 'ROOT-1' }],
      craftedItems: ['boot'],
      board: {
        kind: 'marquise',
        supply: { warriors: 18, wood: 3 },
        tracks: {
          sawmill: { placed: 4 },
          workshop: { placed: 5 },
          recruiter: { placed: 3 },
        },
      },
    })

    expect(view).not.toBeNull()
    if (view === null || view.kind !== 'marquise') {
      throw new Error('expected marquise view')
    }
    expect(view.warriors).toBe(18)
    expect(view.wood).toBe(3)
    expect(view.handSize).toBe(1)
    expect(view.emptiedColumnCount).toEqual({
      sawmill: 2,
      workshop: 1,
      recruiter: 3,
    })
    expect(view.crafted.itemTypes).toEqual(['boot'])
    expect(view.trackColumns).toHaveLength(6)
  })

  it('Eyrie: roosts on map + leader lookup', () => {
    const view = buildFactionBoardViewModelFromPlayer({
      seat: 1,
      faction: 'eyrie',
      vp: 2,
      hand: [],
      board: {
        kind: 'eyrie',
        supply: { warriors: 14 },
        leader: 'despot',
        roostTrack: { placed: 5 },
        decree: {
          recruit: [{ id: 'v1', defId: 'VIZIER' }],
          move: [{ id: 'c1', defId: 'ROOT-1' }],
          battle: [],
          build: [],
        },
      },
    })

    expect(view).not.toBeNull()
    if (view === null || view.kind !== 'eyrie') {
      throw new Error('expected eyrie view')
    }
    expect(view.roostsOnMap).toBe(2)
    expect(view.leader?.id).toBe('despot')
    expect(view.leader?.name).toBe('Despot')
    expect(view.roostTrack).toHaveLength(7)
    expect(view.decreeColumns).toEqual([
      {
        columnId: 'recruit',
        regionId: 'decree-recruit',
        suits: ['bird'],
      },
      {
        columnId: 'move',
        regionId: 'decree-move',
        suits: [expect.any(String)],
      },
      {
        columnId: 'battle',
        regionId: 'decree-battle',
        suits: [],
      },
      {
        columnId: 'build',
        regionId: 'decree-build',
        suits: [],
      },
    ])
  })

  it('returns null for missing board', () => {
    expect(
      buildFactionBoardViewModelFromPlayer({
        seat: 0,
        faction: 'marquise',
        vp: 0,
        hand: [],
      }),
    ).toBeNull()
  })
})
