export type StoredPlayerIdentity = {
  playerId: string
  apiBaseUrl: string
}

const STORAGE_KEY = 'root.react.playerIdentity'
/** @deprecated Legacy key from `@root/phaser`; still read once for migrate. */
const LEGACY_STORAGE_KEY = 'root.phaser.playerIdentity'

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

function parseStoredIdentity(raw: string): StoredPlayerIdentity | null {
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

/** Persist join identity for Continue / reconnect. */
export function savePlayerIdentity(
  identity: StoredPlayerIdentity,
  storage: PlayerIdentityStorage | null = defaultStorage(),
): void {
  if (storage === null) {
    return
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(identity))
  storage.removeItem(LEGACY_STORAGE_KEY)
}

/** Load stored identity, or null if missing / corrupt. */
export function loadPlayerIdentity(
  storage: PlayerIdentityStorage | null = defaultStorage(),
): StoredPlayerIdentity | null {
  if (storage === null) {
    return null
  }
  const currentRaw = storage.getItem(STORAGE_KEY)
  if (currentRaw !== null) {
    return parseStoredIdentity(currentRaw)
  }
  const legacyRaw = storage.getItem(LEGACY_STORAGE_KEY)
  if (legacyRaw === null) {
    return null
  }
  const legacyIdentity = parseStoredIdentity(legacyRaw)
  if (legacyIdentity === null) {
    return null
  }
  savePlayerIdentity(legacyIdentity, storage)
  return legacyIdentity
}

/** Clear stored identity (End game / leave). */
export function clearPlayerIdentity(
  storage: PlayerIdentityStorage | null = defaultStorage(),
): void {
  if (storage === null) {
    return
  }
  storage.removeItem(STORAGE_KEY)
  storage.removeItem(LEGACY_STORAGE_KEY)
}
