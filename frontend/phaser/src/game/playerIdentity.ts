export type StoredPlayerIdentity = {
  playerId: string
  apiBaseUrl: string
}

const STORAGE_KEY = 'root.phaser.playerIdentity'

export type PlayerIdentityStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

function defaultStorage(): PlayerIdentityStorage | null {
  // sessionStorage = per browser tab so two windows on one machine keep seats.
  if (typeof sessionStorage === 'undefined') {
    return null
  }
  return sessionStorage
}

function isStoredPlayerIdentity(value: unknown): value is StoredPlayerIdentity {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('playerId' in value) || !('apiBaseUrl' in value)) {
    return false
  }
  const record = value
  return (
    typeof record.playerId === 'string' &&
    record.playerId.length > 0 &&
    typeof record.apiBaseUrl === 'string'
  )
}

/** Persist join identity for Continue / reconnect. */
export function savePlayerIdentity(
  identity: StoredPlayerIdentity,
  storage: PlayerIdentityStorage | null = defaultStorage(),
): void {
  if (storage === null) {
    return
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(identity))
}

/** Load stored identity, or null if missing / corrupt. */
export function loadPlayerIdentity(
  storage: PlayerIdentityStorage | null = defaultStorage(),
): StoredPlayerIdentity | null {
  if (storage === null) {
    return null
  }
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isStoredPlayerIdentity(parsed)) {
    return null
  }
  return parsed
}

/** Clear stored identity (End game / leave). */
export function clearPlayerIdentity(
  storage: PlayerIdentityStorage | null = defaultStorage(),
): void {
  if (storage === null) {
    return
  }
  storage.removeItem(STORAGE_KEY)
}
