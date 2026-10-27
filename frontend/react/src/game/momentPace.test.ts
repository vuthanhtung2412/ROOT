import { describe, expect, it } from 'vitest'
import {
  atMomentPace,
  EYRIE_MOMENT_SLOWDOWN,
  momentMs,
  MOMENT_SLOWDOWN,
} from '#game/momentPace.ts'

const MOCKUP_DURATION_MS = 400
const MOCKUP_DELAY_MS = 150

describe('moment pace', () => {
  it('plays every beat slower than the mockup', () => {
    expect(momentMs(MOCKUP_DURATION_MS)).toBe(MOCKUP_DURATION_MS * MOMENT_SLOWDOWN)
  })

  it('slows the duration and the delay of an animation, nothing else', () => {
    expect(
      atMomentPace({
        duration: MOCKUP_DURATION_MS,
        delay: MOCKUP_DELAY_MS,
        fill: 'both',
      }),
    ).toEqual({
      duration: MOCKUP_DURATION_MS * MOMENT_SLOWDOWN,
      delay: MOCKUP_DELAY_MS * MOMENT_SLOWDOWN,
      fill: 'both',
    })
  })
})

describe('eyrie moment pace', () => {
  it('plays the eyrie beats less slow than the others', () => {
    expect(momentMs(MOCKUP_DURATION_MS, EYRIE_MOMENT_SLOWDOWN)).toBe(
      MOCKUP_DURATION_MS * EYRIE_MOMENT_SLOWDOWN,
    )
    expect(EYRIE_MOMENT_SLOWDOWN).toBeLessThan(MOMENT_SLOWDOWN)
  })
})
