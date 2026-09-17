import { GameMap } from './GameMap.js'
import type { Clearing } from './types.js'

/** Fall (Autumn) clearing ids are 0..11. Source: therootdatabase.com/map/autumn + rootgame autumn_map_setup. */
const SLOTS = [1, 2, 1, 1, 2, 2, 2, 2, 2, 2, 3, 2] as const
const RUIN_CLEARINGS = new Set([5, 9, 10, 11])

const FOX = new Set([0, 5, 7, 11])
const RABBIT = new Set([2, 3, 4, 9])
const MOUSE = new Set([1, 6, 8, 10])

function suitOf(id: number): Clearing['suit'] {
  if (FOX.has(id)) return 'fox'
  if (RABBIT.has(id)) return 'rabbit'
  if (MOUSE.has(id)) return 'mouse'
  throw new Error(`unknown clearing suit: ${id}`)
}

const clearings: Clearing[] = Array.from({ length: 12 }, (_, id) => ({
  id,
  suit: suitOf(id),
  slots: SLOTS[id]!,
  ruinSlot: RUIN_CLEARINGS.has(id),
}))

export const FALL = new GameMap({ clearings, paths: [] })
