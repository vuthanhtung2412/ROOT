import type { ActionSpec } from '#api/client.ts'

/** A tile of the dock: an action, told apart from the others by its key. */
export type KeyedAction = {
  key: string
  spec: ActionSpec
}

/** A tile kept in place for the whole phase; spent once no longer legal. */
export type PhaseTile = KeyedAction & {
  isSpent: boolean
}

/** Tiles seen so far in one phase of one turn, in the order they appeared. */
export type PhaseTileMemory = {
  phaseKey: string | null
  tiles: readonly KeyedAction[]
}

export const EMPTY_PHASE_TILE_MEMORY: PhaseTileMemory = {
  phaseKey: null,
  tiles: [],
}

/**
 * Adds the live tiles to what the phase has shown so far. A new phase starts
 * over. The answers to a pending event (`phaseKey` null) are not tiles of the
 * phase: the memory is left as it is, to pick up after the event.
 */
export function rememberPhaseTiles(
  memory: PhaseTileMemory,
  phaseKey: string | null,
  live: readonly KeyedAction[],
): PhaseTileMemory {
  if (phaseKey === null) {
    return memory
  }
  if (memory.phaseKey !== phaseKey) {
    return { phaseKey, tiles: live }
  }
  const liveByKey: ReadonlyMap<string, KeyedAction> = new Map(
    live.map((tile) => [tile.key, tile]),
  )
  const knownKeys: ReadonlySet<string> = new Set(
    memory.tiles.map((tile) => tile.key),
  )
  return {
    phaseKey,
    tiles: [
      // A tile seen again takes its latest action (targets change).
      ...memory.tiles.map((tile) => liveByKey.get(tile.key) ?? tile),
      ...live.filter((tile) => !knownKeys.has(tile.key)),
    ],
  }
}

/** Every tile of the phase in its place; the ones not legal now are spent. */
export function phaseTilesOf(
  memory: PhaseTileMemory,
  live: readonly KeyedAction[],
): PhaseTile[] {
  const liveKeys: ReadonlySet<string> = new Set(live.map((tile) => tile.key))
  return memory.tiles.map((tile) => ({
    ...tile,
    isSpent: !liveKeys.has(tile.key),
  }))
}
