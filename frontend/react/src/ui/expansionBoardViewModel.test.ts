import { describe, expect, it } from 'vitest'
import {
  factionBoardLayoutForKind,
  findBoardLayoutRegion,
  trackCellRegion,
} from '#assets/factionBoardLayout.ts'
import { makeGameState } from '#test/factories.ts'
import {
  LIZARD_GARDEN_TRACK_SLOT_COUNT,
  RIVERFOLK_SERVICE_IDS,
  RIVERFOLK_TRADE_POST_TRACK_SLOT_COUNT,
} from '#ui/expansionBoardViewModel.ts'
import {
  buildFactionBoardViewModel,
  buildFactionBoardViewModelFromPlayer,
} from '#ui/factionBoardViewModel.ts'

type BoardPlayer = Parameters<typeof buildFactionBoardViewModelFromPlayer>[0]

function makeLizardPlayer(): BoardPlayer {
  return {
    seat: 1,
    faction: 'lizard',
    vp: 4,
    hand: [{ id: 'ROOT-204#1', defId: 'ROOT-204' }],
    board: {
      kind: 'lizard',
      supply: { warriors: 18 },
      acolytes: 2,
      outcast: 'rabbit',
      hated: true,
      gardens: { fox: 5, rabbit: 3, mouse: 4 },
      revealed: [{ id: 'ROOT-206#1', defId: 'ROOT-206' }],
    },
  }
}

function makeRiverfolkPlayer(): BoardPlayer {
  return {
    seat: 1,
    faction: 'riverfolk',
    vp: 6,
    hand: [],
    board: {
      kind: 'riverfolk',
      supply: { warriors: 7 },
      payments: [0],
      funds: [1, 0, 1],
      committed: [1],
      tradePosts: { fox: 3, rabbit: 2, mouse: 3 },
      craftCommitted: { fox: [], rabbit: [0], mouse: [] },
      serviceCosts: { handCard: 1, riverboats: 3, mercenaries: 4 },
    },
  }
}

describe('Lizard Cult board view model', () => {
  it('reads acolytes, the Outcast, garden tracks and revealed cards', () => {
    const view = buildFactionBoardViewModelFromPlayer(makeLizardPlayer())
    if (view?.kind !== 'lizard') throw new Error('expected lizard board')
    expect(view.factionName).toBe('Lizard Cult')
    expect(view.warriors).toBe(18)
    expect(view.acolytes).toBe(2)
    expect(view.outcast).toBe('rabbit')
    expect(view.hated).toBe(true)
    expect(view.gardensOnTrack).toEqual({ fox: 5, rabbit: 3, mouse: 4 })
    expect(view.revealedDefIds).toEqual(['ROOT-206'])
    expect(view.handSize).toBe(1)
  })

  it('counts the Lost Souls pile from the deck', () => {
    const state = makeGameState({
      factions: ['marquise', 'lizard'],
      players: [
        makeGameState().players[0]!,
        { ...makeLizardPlayer(), playerId: 'lizard' },
      ],
    })
    Reflect.set(state, 'deck', {
      draw: [],
      discard: [],
      lostSouls: [{ id: 'ROOT-204#1', defId: 'ROOT-204' }],
    })
    const view = buildFactionBoardViewModel(state, 1)
    expect(view?.kind === 'lizard' && view.lostSoulsCount).toBe(1)
  })
})

describe('Riverfolk Company board view model', () => {
  it('names the faction of every warrior in the three boxes', () => {
    const view = buildFactionBoardViewModelFromPlayer(makeRiverfolkPlayer(), [
      'marquise',
      'riverfolk',
    ])
    if (view?.kind !== 'riverfolk') throw new Error('expected riverfolk board')
    expect(view.payments).toEqual(['marquise'])
    expect(view.funds).toEqual(['riverfolk', 'marquise', 'riverfolk'])
    expect(view.committed).toEqual(['riverfolk'])
    expect(view.craftCommitted.rabbit).toEqual(['marquise'])
    expect(view.tradePostsOnTrack.rabbit).toBe(2)
    expect(view.serviceCosts).toEqual({
      handCard: 1,
      riverboats: 3,
      mercenaries: 4,
    })
  })

  it('rejects a board that does not match the faction', () => {
    const player = { ...makeRiverfolkPlayer(), faction: 'lizard' }
    expect(buildFactionBoardViewModelFromPlayer(player)).toBeNull()
  })
})

describe('expansion board layouts', () => {
  it('places every Lizard Cult overlay inside the board art', () => {
    const layout = factionBoardLayoutForKind('lizard')
    for (const regionId of [
      'crafted-items',
      'supply-warriors',
      'acolytes',
      'revealed',
      'outcast-fox',
      'outcast-rabbit',
      'outcast-mouse',
      'lost-souls',
    ]) {
      const region = findBoardLayoutRegion(layout, regionId)
      expect(region, regionId).not.toBeNull()
      expect(region!.x + region!.width).toBeLessThanOrEqual(layout.naturalWidth)
      expect(region!.y + region!.height).toBeLessThanOrEqual(
        layout.naturalHeight,
      )
    }
    for (const suit of ['fox', 'rabbit', 'mouse']) {
      const lastCell = trackCellRegion(
        layout,
        `garden-${suit}`,
        LIZARD_GARDEN_TRACK_SLOT_COUNT - 1,
      )
      expect(lastCell, suit).not.toBeNull()
      expect(lastCell!.x + lastCell!.width).toBeLessThanOrEqual(
        layout.naturalWidth,
      )
    }
  })

  it('places every Riverfolk overlay inside the board art', () => {
    const layout = factionBoardLayoutForKind('riverfolk')
    for (const regionId of ['payments', 'funds', 'committed', 'crafted-items']) {
      expect(findBoardLayoutRegion(layout, regionId), regionId).not.toBeNull()
    }
    for (const service of RIVERFOLK_SERVICE_IDS) {
      const lastCost = trackCellRegion(layout, `service-${service}`, 3)
      expect(lastCost, service).not.toBeNull()
      expect(lastCost!.x + lastCost!.width).toBeLessThanOrEqual(
        layout.naturalWidth,
      )
    }
    for (const suit of ['fox', 'rabbit', 'mouse']) {
      const lastPost = trackCellRegion(
        layout,
        `trade-post-${suit}`,
        RIVERFOLK_TRADE_POST_TRACK_SLOT_COUNT - 1,
      )
      expect(lastPost, suit).not.toBeNull()
      expect(lastPost!.y + lastPost!.height).toBeLessThanOrEqual(
        layout.naturalHeight,
      )
    }
  })
})
