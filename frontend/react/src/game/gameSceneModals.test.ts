import { beforeEach, describe, expect, it } from 'vitest'
import {
  getCardPileSnapshot,
  hideCardPile,
} from '#game/cardGalleryBridge.ts'
import { GameSceneModals } from '#game/gameSceneModals.ts'
import { makeGameState } from '#test/factories.ts'

const ALLIANCE_SEAT = 2
const OTHER_SEAT = 0

describe('GameSceneModals.openSupporters', () => {
  beforeEach(() => {
    hideCardPile()
  })

  it('opens supporter faces in card pile gallery', () => {
    const modals = new GameSceneModals(() => ALLIANCE_SEAT)
    const state = makeGameState({
      players: [
        {
          playerId: 'alliance',
          seat: 2,
          faction: 'alliance',
          vp: 0,
          hand: [],
          board: {
            kind: 'alliance',
            supply: { warriors: 8 },
            supporters: [
              { id: 's1', defId: 'ROOT-1' },
              { id: 's2', defId: 'ROOT-2' },
            ],
            officers: 0,
            bases: [],
            sympathyTrack: { placed: 10 },
          },
        },
      ],
    })

    modals.openSupporters(state, 2)

    expect(getCardPileSnapshot()).toEqual({
      title: 'Supporters (2)',
      cards: [
        { id: 's1', defId: 'ROOT-1' },
        { id: 's2', defId: 'ROOT-2' },
      ],
      emptyMessage: 'No supporters',
    })
  })

  it('toggles closed when supporters pile already open', () => {
    const modals = new GameSceneModals(() => ALLIANCE_SEAT)
    const state = makeGameState({
      players: [
        {
          playerId: 'alliance',
          seat: 2,
          faction: 'alliance',
          vp: 0,
          hand: [],
          board: {
            kind: 'alliance',
            supply: { warriors: 8 },
            supporters: [{ id: 's1', defId: 'ROOT-1' }],
            officers: 0,
            bases: [],
            sympathyTrack: { placed: 10 },
          },
        },
      ],
    })

    modals.openSupporters(state, 2)
    modals.openSupporters(state, 2)

    expect(getCardPileSnapshot()).toBeNull()
  })

  it('keeps supporters face down for any seat but the Alliance', () => {
    const modals = new GameSceneModals(() => OTHER_SEAT)
    const state = makeGameState({
      players: [
        {
          playerId: 'alliance',
          seat: ALLIANCE_SEAT,
          faction: 'alliance',
          vp: 0,
          hand: [],
          board: {
            kind: 'alliance',
            supply: { warriors: 8 },
            supporters: [{ id: 's1', defId: 'ROOT-1' }],
            officers: 0,
            bases: [],
            sympathyTrack: { placed: 10 },
          },
        },
      ],
    })

    modals.openSupporters(state, ALLIANCE_SEAT)

    expect(getCardPileSnapshot()).toBeNull()
  })
})

describe('GameSceneModals.openPublicHand', () => {
  const riverfolkHand = [{ id: 'ROOT-204#1', defId: 'ROOT-204' }]

  function stateWithRiverfolk(): ReturnType<typeof makeGameState> {
    return makeGameState({
      factions: ['marquise', 'riverfolk'],
      players: [
        { playerId: 'marquise', seat: 0, faction: 'marquise', vp: 0, hand: [] },
        {
          playerId: 'riverfolk',
          seat: 1,
          faction: 'riverfolk',
          vp: 0,
          hand: riverfolkHand,
        },
      ],
    })
  }

  beforeEach(() => {
    hideCardPile()
  })

  it('Rule: 11.2.3 Public Hand — any viewer opens the Riverfolk hand', () => {
    const modals = new GameSceneModals(() => OTHER_SEAT)

    modals.openPublicHand(stateWithRiverfolk(), 1)

    expect(getCardPileSnapshot()).toEqual({
      title: 'Riverfolk hand (1)',
      cards: riverfolkHand,
      emptyMessage: 'Riverfolk hand empty',
    })
  })

  it('toggles closed on a second click; other hands stay private', () => {
    const modals = new GameSceneModals(() => OTHER_SEAT)
    const state = stateWithRiverfolk()

    modals.openPublicHand(state, 1)
    modals.openPublicHand(state, 1)
    expect(getCardPileSnapshot()).toBeNull()

    modals.openPublicHand(state, 0)
    expect(getCardPileSnapshot()).toBeNull()
  })
})
