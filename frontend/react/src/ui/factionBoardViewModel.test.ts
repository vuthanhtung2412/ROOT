import { describe, expect, it } from 'vitest'
import {
  buildFactionBoardViewModelFromPlayer,
  formatDecreeSuitCounts,
  groupCraftedItems,
} from '#ui/factionBoardViewModel.ts'

describe('groupCraftedItems', () => {
  it('groups by type and exhausted with counts', () => {
    expect(
      groupCraftedItems([
        'boot',
        'boot',
        { type: 'tea', exhausted: true },
        { type: 'tea', exhausted: true },
        { type: 'tea', exhausted: false },
      ]),
    ).toEqual([
      { type: 'boot', exhausted: false, count: 2 },
      { type: 'tea', exhausted: true, count: 2 },
      { type: 'tea', exhausted: false, count: 1 },
    ])
  })
})

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
    expect(view.crafted.items).toEqual([
      { type: 'boot', exhausted: false, count: 1 },
    ])
    expect(view.trackColumns).toHaveLength(6)
  })

  it('preserves crafted item exhausted flag', () => {
    const view = buildFactionBoardViewModelFromPlayer({
      seat: 0,
      faction: 'marquise',
      vp: 0,
      hand: [],
      craftedItems: [
        { type: 'tea', exhausted: true },
        { type: 'sword', exhausted: false },
      ],
      board: {
        kind: 'marquise',
        supply: { warriors: 20, wood: 0 },
        tracks: {
          sawmill: { placed: 6 },
          workshop: { placed: 6 },
          recruiter: { placed: 6 },
        },
      },
    })
    expect(view).not.toBeNull()
    if (view === null) {
      throw new Error('expected view')
    }
    expect(view.crafted.items).toEqual([
      { type: 'tea', exhausted: true, count: 1 },
      { type: 'sword', exhausted: false, count: 1 },
    ])
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

  it('Alliance: officers + sympathy tokens still on track', () => {
    const view = buildFactionBoardViewModelFromPlayer({
      seat: 2,
      faction: 'alliance',
      vp: 3,
      hand: [{ id: 'a', defId: 'ROOT-1' }],
      board: {
        kind: 'alliance',
        supply: { warriors: 8 },
        supporters: [{ id: 's1' }, { id: 's2' }],
        officers: 2,
        bases: ['fox', 'mouse'],
        sympathyTrack: { placed: 3 },
      },
    })
    expect(view).not.toBeNull()
    if (view === null || view.kind !== 'alliance') {
      throw new Error('expected alliance view')
    }
    expect(view.warriors).toBe(8)
    expect(view.officers).toBe(2)
    expect(view.supporters).toBe(2)
    expect(view.basesInSupply).toEqual(['fox', 'mouse'])
    expect(view.sympathyTokensOnTrack).toBe(7)
    expect(view.sympathyTrack).toHaveLength(10)
  })

  it('Vagabond: satchel + tracks + damaged', () => {
    const view = buildFactionBoardViewModelFromPlayer({
      seat: 3,
      faction: 'vagabond',
      vp: 1,
      hand: [],
      board: {
        kind: 'vagabond',
        satchel: [
          { type: 'boot', exhausted: false },
          { type: 'torch', exhausted: true },
        ],
        tracks: {
          tea: [{ type: 'tea', exhausted: false }],
          coin: [],
          bag: [{ type: 'bag', exhausted: true }],
        },
        damaged: [{ type: 'sword', exhausted: true }],
        forest: null,
      },
    })
    expect(view).not.toBeNull()
    if (view === null || view.kind !== 'vagabond') {
      throw new Error('expected vagabond view')
    }
    expect(view.satchel).toHaveLength(2)
    expect(view.tracks.tea).toHaveLength(1)
    expect(view.tracks.bag[0]?.exhausted).toBe(true)
    expect(view.damaged).toEqual([{ type: 'sword', exhausted: true }])
    expect(view.startingItems).toContain('torch')
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
