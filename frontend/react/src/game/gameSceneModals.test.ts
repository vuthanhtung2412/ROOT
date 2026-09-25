import { beforeEach, describe, expect, it } from 'vitest'
import {
  getCardPileSnapshot,
  hideCardPile,
} from '#game/cardGalleryBridge.ts'
import { GameSceneModals } from '#game/gameSceneModals.ts'
import { makeGameState } from '#test/factories.ts'

describe('GameSceneModals.openSupporters', () => {
  beforeEach(() => {
    hideCardPile()
  })

  it('opens supporter faces in card pile gallery', () => {
    const modals = new GameSceneModals()
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
    const modals = new GameSceneModals()
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
})
