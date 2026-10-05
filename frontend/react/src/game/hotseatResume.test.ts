import { describe, expect, it } from 'vitest'
import {
  clearHotseatGameOpen,
  isHotseatGameOpen,
  markHotseatGameOpen,
} from '#game/hotseatResume.ts'
import type { PlayerIdentityStorage } from '#game/playerIdentity.ts'

function createMemoryStorage(): PlayerIdentityStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

describe('hotseatResume', () => {
  it('is closed until a hotseat game is marked open', () => {
    const storage = createMemoryStorage()

    expect(isHotseatGameOpen(storage)).toBe(false)
    markHotseatGameOpen(storage)
    expect(isHotseatGameOpen(storage)).toBe(true)
  })

  it('is closed again after returning to the menu', () => {
    const storage = createMemoryStorage()
    markHotseatGameOpen(storage)

    clearHotseatGameOpen(storage)

    expect(isHotseatGameOpen(storage)).toBe(false)
  })

  it('stays closed without storage', () => {
    markHotseatGameOpen(null)

    expect(isHotseatGameOpen(null)).toBe(false)
  })
})
