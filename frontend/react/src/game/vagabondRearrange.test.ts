import { describe, expect, it } from 'vitest'
import {
  findRearrangeSpec,
  REARRANGE_ACTION_TYPE,
} from '#game/vagabondRearrange.ts'
import { makeActionSpec } from '#test/factories.ts'

const VAGABOND_SEAT = 3
const OTHER_SEAT = 0

describe('findRearrangeSpec', () => {
  const teaFromTrack = makeActionSpec({
    type: REARRANGE_ACTION_TYPE,
    actor: VAGABOND_SEAT,
    params: { itemTypes: ['tea'], rearrangeFrom: ['track'] },
  })
  const bagFromSatchel = makeActionSpec({
    type: REARRANGE_ACTION_TYPE,
    actor: VAGABOND_SEAT,
    params: { itemTypes: ['bag'], rearrangeFrom: ['satchel'] },
  })
  const actions = [makeActionSpec(), teaFromTrack, bagFromSatchel]

  it('finds the spec for the exact item and origin', () => {
    expect(
      findRearrangeSpec(actions, {
        seat: VAGABOND_SEAT,
        itemType: 'bag',
        from: 'satchel',
      }),
    ).toBe(bagFromSatchel)
  })

  it('returns null when the engine does not offer that direction', () => {
    expect(
      findRearrangeSpec(actions, {
        seat: VAGABOND_SEAT,
        itemType: 'tea',
        from: 'satchel',
      }),
    ).toBeNull()
  })

  it('ignores specs of another seat', () => {
    expect(
      findRearrangeSpec(actions, {
        seat: OTHER_SEAT,
        itemType: 'tea',
        from: 'track',
      }),
    ).toBeNull()
  })
})
