import { describe, expect, it } from 'vitest'
import { CLEARING_FLASH_MS } from '#game/clearingFlash.ts'
import { clearingFlashStrength } from '#game/map3d/clearingFlashMark.ts'

const MILLISECONDS_PER_SECOND = 1000
const FLASH_SECONDS = CLEARING_FLASH_MS / MILLISECONDS_PER_SECOND
const HALF = 0.5

describe('clearingFlashStrength', () => {
  it('is full as the flash starts', () => {
    expect(clearingFlashStrength(0)).toBe(1)
  })

  it('has lost most of its strength halfway', () => {
    expect(clearingFlashStrength(FLASH_SECONDS * HALF)).toBeCloseTo(0.25)
  })

  it('is gone once the flash is over', () => {
    expect(clearingFlashStrength(FLASH_SECONDS)).toBe(0)
    expect(clearingFlashStrength(FLASH_SECONDS * 2)).toBe(0)
  })
})
