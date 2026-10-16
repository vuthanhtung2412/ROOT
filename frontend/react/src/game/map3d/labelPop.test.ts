import { describe, expect, it } from 'vitest'
import {
  createLabelPops,
  easeOutBack,
  LABELS_GONE_FROM_ZOOM,
  zoomedLabelScale,
  type LabelPops,
} from '#game/map3d/labelPop.ts'

const ZOOMED_OUT = 0
const HALF_WAY_TO_GONE: number = LABELS_GONE_FROM_ZOOM / 2
const ZOOMED_IN = 1
const PIECE_KEY = 'piece-a'
const OTHER_PIECE_KEY = 'piece-b'
const LONG_ENOUGH_SECONDS = 1
const ONE_FRAME_SECONDS = 0.016
const MID_POP_PROGRESS = 0.7
const HALF_POP_SECONDS = 0.11

describe('zoomedLabelScale', () => {
  it('shrinks from full size to nothing by the threshold', () => {
    expect(zoomedLabelScale(ZOOMED_OUT)).toBe(1)
    expect(zoomedLabelScale(HALF_WAY_TO_GONE)).toBeCloseTo(0.5)
    expect(zoomedLabelScale(LABELS_GONE_FROM_ZOOM)).toBe(0)
    expect(zoomedLabelScale(ZOOMED_IN)).toBe(0)
  })
})

describe('easeOutBack', () => {
  it('starts at 0, overshoots, ends at 1', () => {
    expect(easeOutBack(0)).toBeCloseTo(0)
    expect(easeOutBack(MID_POP_PROGRESS)).toBeGreaterThan(1)
    expect(easeOutBack(1)).toBeCloseTo(1)
  })
})

describe('createLabelPops', () => {
  it('pops the hovered label up, then shrinks it away', () => {
    const pops: LabelPops<string> = createLabelPops<string>()
    expect(pops.scaleOf(PIECE_KEY)).toBe(0)
    pops.setHovered(PIECE_KEY)
    pops.update(ONE_FRAME_SECONDS)
    expect(pops.scaleOf(PIECE_KEY)).toBeGreaterThan(0)
    expect(pops.isAnimating()).toBe(true)
    pops.update(LONG_ENOUGH_SECONDS)
    expect(pops.scaleOf(PIECE_KEY)).toBeCloseTo(1)
    expect(pops.isAnimating()).toBe(false)

    pops.setHovered(OTHER_PIECE_KEY)
    pops.update(LONG_ENOUGH_SECONDS)
    expect(pops.scaleOf(PIECE_KEY)).toBe(0)
    expect(pops.scaleOf(OTHER_PIECE_KEY)).toBeCloseTo(1)
  })

  it('goes on from the size it has when the pointer turns mid-pop', () => {
    const pops: LabelPops<string> = createLabelPops<string>()
    pops.setHovered(PIECE_KEY)
    pops.update(HALF_POP_SECONDS)
    const sizeWhenLeft: number = pops.scaleOf(PIECE_KEY)
    pops.setHovered(null)
    expect(pops.scaleOf(PIECE_KEY)).toBeCloseTo(sizeWhenLeft)

    pops.update(HALF_POP_SECONDS)
    const sizeWhenBack: number = pops.scaleOf(PIECE_KEY)
    pops.setHovered(PIECE_KEY)
    expect(pops.scaleOf(PIECE_KEY)).toBeCloseTo(sizeWhenBack)
    pops.update(LONG_ENOUGH_SECONDS)
    expect(pops.scaleOf(PIECE_KEY)).toBeCloseTo(1)
  })
})
