import { describe, expect, it } from 'vitest'
import {
  isMapMomentEffect,
  mapMomentEffectsBetween,
  type MapMomentState,
} from '#game/mapMoments.ts'

const RUIN_CLEARING = 2
const REVOLT_CLEARING = 5

function stateWithRuin(items: readonly string[] | null): MapMomentState {
  return {
    id: 'test-game',
    clearings: Array.from({ length: 12 }, (_, clearing: number) =>
      clearing === RUIN_CLEARING && items !== null ? { ruin: { items } } : {},
    ),
  }
}

describe('mapMomentEffectsBetween', () => {
  it('tells the explored ruin and the item it gave up', () => {
    expect(
      mapMomentEffectsBetween(stateWithRuin(['boot']), stateWithRuin(null), [
        { t: 'action', actor: 2, action: { type: 'explore' } },
      ]),
    ).toEqual([{ kind: 'explore', clearing: RUIN_CLEARING, itemType: 'boot' }])
  })

  it('tells the clearing of a revolt', () => {
    const state: MapMomentState = stateWithRuin(null)
    expect(
      mapMomentEffectsBetween(state, state, [
        {
          t: 'action',
          actor: 1,
          action: { type: 'revolt', clearing: REVOLT_CLEARING, supporterIds: [] },
        },
      ]),
    ).toEqual([{ kind: 'revolt', clearing: REVOLT_CLEARING }])
  })

  it('tells the clearing and item a bot explore names', () => {
    expect(
      mapMomentEffectsBetween(stateWithRuin(['boot', 'sword']), stateWithRuin(['sword']), [
        {
          t: 'action',
          actor: 2,
          action: { type: 'botExplore', clearing: RUIN_CLEARING, item: 'boot' },
        },
      ]),
    ).toEqual([{ kind: 'explore', clearing: RUIN_CLEARING, itemType: 'boot' }])
  })

  it('tells the clearing of a bot revolt', () => {
    const state: MapMomentState = stateWithRuin(null)
    expect(
      mapMomentEffectsBetween(state, state, [
        {
          t: 'action',
          actor: 1,
          action: { type: 'botRevolt', clearing: REVOLT_CLEARING },
        },
      ]),
    ).toEqual([{ kind: 'revolt', clearing: REVOLT_CLEARING }])
  })

  it('tells nothing for another game', () => {
    expect(
      mapMomentEffectsBetween(
        { ...stateWithRuin(['boot']), id: 'old-game' },
        stateWithRuin(null),
        [{ t: 'action', actor: 2, action: { type: 'explore' } }],
      ),
    ).toEqual([])
  })

  it('knows its own effects from the piece effects', () => {
    expect(isMapMomentEffect({ kind: 'revolt' })).toBe(true)
    expect(isMapMomentEffect({ kind: 'place' })).toBe(false)
  })
})
