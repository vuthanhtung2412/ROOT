import { describe, expect, it } from 'vitest'
import {
  clearPlayerIdentity,
  loadPlayerIdentity,
  savePlayerIdentity,
  type PlayerIdentityStorage,
} from './playerIdentity.ts'

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

describe('playerIdentity', () => {
  it('saves and loads identity', () => {
    const storage = createMemoryStorage()
    savePlayerIdentity(
      { playerId: 'marquise', apiBaseUrl: 'http://192.168.1.5:3000' },
      storage,
    )
    expect(loadPlayerIdentity(storage)).toEqual({
      playerId: 'marquise',
      apiBaseUrl: 'http://192.168.1.5:3000',
    })
  })

  it('clears identity', () => {
    const storage = createMemoryStorage()
    savePlayerIdentity({ playerId: 'eyrie', apiBaseUrl: '' }, storage)
    clearPlayerIdentity(storage)
    expect(loadPlayerIdentity(storage)).toBeNull()
  })

  it('returns null for corrupt JSON', () => {
    const storage = createMemoryStorage()
    storage.setItem('root.phaser.playerIdentity', '{bad')
    expect(loadPlayerIdentity(storage)).toBeNull()
  })

  it('returns null for invalid shape', () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'root.phaser.playerIdentity',
      JSON.stringify({ playerId: 1 }),
    )
    expect(loadPlayerIdentity(storage)).toBeNull()
  })
})
